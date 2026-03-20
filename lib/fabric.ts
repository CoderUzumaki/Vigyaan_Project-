/**
 * lib/fabric.ts — Fabric Gateway SDK Client
 *
 * Provides:
 * 1. Low-level getFabricContract() — connects to a peer via gRPC
 * 2. High-level helper functions — one per chaincode operation
 *
 * Team B never calls this directly — they use addFabricJob() from lib/fabricQueue.ts.
 * The BullMQ worker in workers/fabricWorker.ts imports these helpers.
 */

import * as grpc from '@grpc/grpc-js';
import {
  connect,
  Contract,
  Gateway,
  Identity,
  Signer,
  signers,
} from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_NAME = process.env.FABRIC_CHANNEL ?? 'safetychannel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE ?? 'safetychaincode';

/** Resolve fabric-samples path: env var → /tmp/fabric-samples fallback */
function getFabricSamplesPath(): string {
  const envPath = process.env.FABRIC_SAMPLES_PATH;
  if (envPath && envPath !== '') return envPath;
  return '/tmp/fabric-samples';
}

type OrgKey = 'orgA' | 'orgB' | 'orgC';

interface OrgConfig {
  mspId: string;
  peerEndpoint: string;
  peerHostAlias: string;
  tlsCertPath: string;
  certPath: string;
  keyDirPath: string;
}

function getOrgConfig(): Record<OrgKey, OrgConfig> {
  const fabricPath = getFabricSamplesPath();
  const orgsBase = path.join(fabricPath, 'test-network', 'organizations', 'peerOrganizations');

  return {
    orgA: {
      mspId: 'Org1MSP',
      peerEndpoint: process.env.ORG1_PEER_ENDPOINT ?? 'localhost:7051',
      peerHostAlias: 'peer0.org1.example.com',
      tlsCertPath: path.join(orgsBase, 'org1.example.com', 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'),
      certPath: path.join(orgsBase, 'org1.example.com', 'users', 'Admin@org1.example.com', 'msp', 'signcerts', 'Admin@org1.example.com-cert.pem'),
      keyDirPath: path.join(orgsBase, 'org1.example.com', 'users', 'Admin@org1.example.com', 'msp', 'keystore'),
    },
    orgB: {
      mspId: 'Org2MSP',
      peerEndpoint: process.env.ORG2_PEER_ENDPOINT ?? 'localhost:9051',
      peerHostAlias: 'peer0.org2.example.com',
      tlsCertPath: path.join(orgsBase, 'org2.example.com', 'peers', 'peer0.org2.example.com', 'tls', 'ca.crt'),
      certPath: path.join(orgsBase, 'org2.example.com', 'users', 'Admin@org2.example.com', 'msp', 'signcerts', 'Admin@org2.example.com-cert.pem'),
      keyDirPath: path.join(orgsBase, 'org2.example.com', 'users', 'Admin@org2.example.com', 'msp', 'keystore'),
    },
    orgC: {
      mspId: 'Org3MSP',
      peerEndpoint: process.env.ORG3_PEER_ENDPOINT ?? 'localhost:11051',
      peerHostAlias: 'peer0.org3.example.com',
      tlsCertPath: path.join(orgsBase, 'org3.example.com', 'peers', 'peer0.org3.example.com', 'tls', 'ca.crt'),
      certPath: path.join(orgsBase, 'org3.example.com', 'users', 'Admin@org3.example.com', 'msp', 'signcerts', 'Admin@org3.example.com-cert.pem'),
      keyDirPath: path.join(orgsBase, 'org3.example.com', 'users', 'Admin@org3.example.com', 'msp', 'keystore'),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level connection helpers
// ─────────────────────────────────────────────────────────────────────────────

async function newGrpcConnection(org: OrgKey): Promise<grpc.Client> {
  const config = getOrgConfig()[org];
  const tlsRootCert = await fs.readFile(config.tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(config.peerEndpoint, tlsCredentials, {
    'grpc.ssl_target_name_override': config.peerHostAlias,
  });
}

async function newIdentity(org: OrgKey): Promise<Identity> {
  const config = getOrgConfig()[org];

  // fabric-ca may store cert with a different name — find it
  const certDir = path.dirname(config.certPath);
  let certFile = config.certPath;
  try {
    await fs.access(certFile);
  } catch {
    // Cert file doesn't exist at exact path — scan the directory
    const files = await fs.readdir(certDir);
    if (files.length > 0) {
      certFile = path.join(certDir, files[0]);
    }
  }

  const credentials = await fs.readFile(certFile);
  return { mspId: config.mspId, credentials };
}

async function newSigner(org: OrgKey): Promise<Signer> {
  const config = getOrgConfig()[org];
  const keyFiles = await fs.readdir(config.keyDirPath);
  if (keyFiles.length === 0) {
    throw new Error(`No private key found in ${config.keyDirPath}`);
  }
  const keyPath = path.join(config.keyDirPath, keyFiles[0]);
  const privateKeyPem = await fs.readFile(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main connection function
// ─────────────────────────────────────────────────────────────────────────────

export interface FabricConnection {
  contract: Contract;
  gateway: Gateway;
  client: grpc.Client;
}

/**
 * Connect to a Fabric peer and return a contract handle.
 * IMPORTANT: caller must close gateway + client when done.
 */
export async function getFabricContract(org: OrgKey): Promise<FabricConnection> {
  const client = await newGrpcConnection(org);
  const gateway = connect({
    client,
    identity: await newIdentity(org),
    signer: await newSigner(org),
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const network = gateway.getNetwork(CHANNEL_NAME);
  const contract = network.getContract(CHAINCODE_NAME);
  return { contract, gateway, client };
}

/**
 * Helper: execute a chaincode function and safely close the connection.
 * Returns the result as a UTF-8 string (or empty string for void txns).
 */
async function executeTransaction(
  org: OrgKey,
  fn: (contract: Contract) => Promise<Uint8Array>,
): Promise<string> {
  const { contract, gateway, client } = await getFabricContract(org);
  try {
    const result = await fn(contract);
    return Buffer.from(result).toString('utf-8');
  } finally {
    gateway.close();
    client.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level helpers — one per chaincode operation
// Each connects with the correct org, submits/evaluates, and closes.
// ─────────────────────────────────────────────────────────────────────────────

/** Register a tourist on the ledger (Org A) */
export async function registerTouristOnChain(
  touristId: string,
  did: string,
  kycHash: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgA', (contract) =>
    contract.submitTransaction('RegisterTourist', touristId, did, kycHash, timestamp),
  );
}

/** Verify a tourist's KYC on the ledger (Org A) */
export async function verifyKYCOnChain(
  touristId: string,
  kycHash: string,
  verifiedBy: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgA', (contract) =>
    contract.submitTransaction('VerifyKYC', touristId, kycHash, verifiedBy, timestamp),
  );
}

/** Set insurance consent for a tourist (Org A) */
export async function setConsentOnChain(
  touristId: string,
  consent: boolean,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgA', (contract) =>
    contract.submitTransaction(
      'SetInsuranceConsent',
      touristId,
      consent.toString(),
      timestamp,
    ),
  );
}

/** Log a confirmed SOS alert on the ledger (Org A) */
export async function logSOSOnChain(
  incidentId: string,
  touristId: string,
  sosType: string,
  intentMethod: string,
  lat: string,
  lng: string,
  kycVerified: boolean,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgA', (contract) =>
    contract.submitTransaction(
      'LogSOSAlert',
      incidentId,
      touristId,
      sosType,
      intentMethod,
      lat,
      lng,
      kycVerified.toString(),
      timestamp,
    ),
  );
}

/** Log a geofence breach on the ledger (Org A) */
export async function logBreachOnChain(
  breachId: string,
  touristId: string,
  lat: string,
  lng: string,
  severity: string,
  zoneName: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgA', (contract) =>
    contract.submitTransaction(
      'LogGeofenceBreach',
      breachId,
      touristId,
      lat,
      lng,
      severity,
      zoneName,
      timestamp,
    ),
  );
}

/** Log a responder dispatch on the ledger (Org B) */
export async function logDispatchOnChain(
  dispatchId: string,
  incidentId: string,
  responderId: string,
  responderType: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgB', (contract) =>
    contract.submitTransaction(
      'LogDispatch',
      dispatchId,
      incidentId,
      responderId,
      responderType,
      timestamp,
    ),
  );
}

/** Update responder status on the ledger (Org B) */
export async function updateResponderStatusOnChain(
  dispatchId: string,
  status: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgB', (contract) =>
    contract.submitTransaction('UpdateResponderStatus', dispatchId, status, timestamp),
  );
}

/** Close an SOS incident on the ledger (Org B) */
export async function closeIncidentOnChain(
  incidentId: string,
  outcome: string,
  closedBy: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  return executeTransaction('orgB', (contract) =>
    contract.submitTransaction(
      'CloseIncident',
      incidentId,
      outcome,
      closedBy,
      timestamp,
    ),
  );
}

/** Query an incident (consent-gated, read-only) (Org C) */
export async function queryIncidentOnChain(incidentId: string): Promise<string> {
  return executeTransaction('orgC', (contract) =>
    contract.evaluateTransaction('QueryIncident', incidentId),
  );
}

/** Verify insurance consent on chain (Org C) */
export async function verifyConsentOnChain(touristId: string): Promise<string> {
  return executeTransaction('orgC', (contract) =>
    contract.evaluateTransaction('VerifyConsentOnChain', touristId),
  );
}

/** Get audit trail for an incident (consent-gated) (Org C) */
export async function getAuditTrailOnChain(incidentId: string): Promise<string> {
  return executeTransaction('orgC', (contract) =>
    contract.evaluateTransaction('GetAuditTrail', incidentId),
  );
}

/** Read a tourist record from the ledger (Org A) */
export async function getTouristOnChain(touristId: string): Promise<string> {
  return executeTransaction('orgA', (contract) =>
    contract.evaluateTransaction('GetTourist', touristId),
  );
}

/** Read an SOS event from the ledger (Org A) */
export async function getSOSEventOnChain(incidentId: string): Promise<string> {
  return executeTransaction('orgA', (contract) =>
    contract.evaluateTransaction('GetSOSEvent', incidentId),
  );
}
