#!/bin/bash
###############################################################################
# deployChaincode.sh
# Full Fabric lifecycle: package → install → approve → commit
# for the safetychaincode on safetychannel across all 3 organisations.
###############################################################################
set -euo pipefail

# ── Configuration (override via env vars) ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Resolve fabric-samples path (try relative, then /tmp symlink) ────────────
if [ -n "${FABRIC_SAMPLES_DIR:-}" ]; then
  true
elif [ -d "${PROJECT_DIR}/../fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="$(cd "${PROJECT_DIR}/../fabric-samples" && pwd)"
elif [ -d "/tmp/fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
else
  echo "ERROR: Cannot find fabric-samples. Set FABRIC_SAMPLES_DIR env var."
  exit 1
fi
TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"

# ── Workaround: fabric-samples scripts can't handle spaces in paths ──────────
if echo "${FABRIC_SAMPLES_DIR}" | grep -q ' '; then
  ln -sfn "${FABRIC_SAMPLES_DIR}" /tmp/fabric-samples
  FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
  TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
fi

CHAINCODE_NAME="${CHAINCODE_NAME:-safetychaincode}"
CHAINCODE_SRC_PATH="${CHAINCODE_SRC_PATH:-${PROJECT_DIR}/../chaincode/safetychaincode}"
CHANNEL_NAME="${CHANNEL_NAME:-safetychannel}"
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"
CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"

# ── Resolve key paths ────────────────────────────────────────────────────────
ORDERER_CA="${TEST_NETWORK_DIR}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
ORDERER_ADDRESS="localhost:7050"

ORG1_PEER_ADDRESS="localhost:7051"
ORG1_TLS_ROOTCERT="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
ORG1_MSP_DIR="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"

ORG2_PEER_ADDRESS="localhost:9051"
ORG2_TLS_ROOTCERT="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
ORG2_MSP_DIR="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"

ORG3_PEER_ADDRESS="localhost:11051"
ORG3_TLS_ROOTCERT="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt"
ORG3_MSP_DIR="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp"

# ── Add peer binary to PATH ─────────────────────────────────────────────────
export PATH="${FABRIC_SAMPLES_DIR}/bin:${PATH}"
export FABRIC_CFG_PATH="${TEST_NETWORK_DIR}/../config/"

# ── Helper: set peer env for a given org ─────────────────────────────────────
set_peer_env() {
  local ORG_NUM="$1"
  case "${ORG_NUM}" in
    1)
      export CORE_PEER_TLS_ENABLED=true
      export CORE_PEER_LOCALMSPID="Org1MSP"
      export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_ROOTCERT}"
      export CORE_PEER_MSPCONFIGPATH="${ORG1_MSP_DIR}"
      export CORE_PEER_ADDRESS="${ORG1_PEER_ADDRESS}"
      ;;
    2)
      export CORE_PEER_TLS_ENABLED=true
      export CORE_PEER_LOCALMSPID="Org2MSP"
      export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_TLS_ROOTCERT}"
      export CORE_PEER_MSPCONFIGPATH="${ORG2_MSP_DIR}"
      export CORE_PEER_ADDRESS="${ORG2_PEER_ADDRESS}"
      ;;
    3)
      export CORE_PEER_TLS_ENABLED=true
      export CORE_PEER_LOCALMSPID="Org3MSP"
      export CORE_PEER_TLS_ROOTCERT_FILE="${ORG3_TLS_ROOTCERT}"
      export CORE_PEER_MSPCONFIGPATH="${ORG3_MSP_DIR}"
      export CORE_PEER_ADDRESS="${ORG3_PEER_ADDRESS}"
      ;;
    *)
      echo "ERROR: Unknown org number: ${ORG_NUM}"
      exit 1
      ;;
  esac
}

# ── Validate prerequisites ───────────────────────────────────────────────────
echo "============================================================"
echo "  Chaincode Deployment: ${CHAINCODE_NAME} v${CHAINCODE_VERSION}"
echo "============================================================"
echo ""

if ! command -v peer &>/dev/null; then
  echo "ERROR: 'peer' CLI not found in PATH."
  echo "  Ensure fabric-samples bin/ is in PATH or set FABRIC_SAMPLES_DIR."
  exit 1
fi

if [ ! -d "${CHAINCODE_SRC_PATH}" ]; then
  echo "ERROR: Chaincode source not found at: ${CHAINCODE_SRC_PATH}"
  echo "  Set CHAINCODE_SRC_PATH to the correct path."
  exit 1
fi

if [ ! -f "${ORDERER_CA}" ]; then
  echo "ERROR: Orderer CA cert not found. Is the network running?"
  echo "  Path: ${ORDERER_CA}"
  exit 1
fi

# ── Step 1: Vendor Go dependencies ──────────────────────────────────────────
echo "[1/6] Vendoring Go dependencies..."
pushd "${CHAINCODE_SRC_PATH}" > /dev/null
if [ -f "go.mod" ]; then
  GO111MODULE=on go mod vendor
  echo "      ✓ Dependencies vendored"
else
  echo "      ⚠ No go.mod found, skipping vendor"
fi
popd > /dev/null
echo ""

# ── Step 2: Package chaincode ───────────────────────────────────────────────
echo "[2/6] Packaging chaincode..."
set_peer_env 1

PACKAGE_FILE="${TEST_NETWORK_DIR}/${CHAINCODE_NAME}.tar.gz"
peer lifecycle chaincode package "${PACKAGE_FILE}" \
  --path "${CHAINCODE_SRC_PATH}" \
  --lang golang \
  --label "${CHAINCODE_LABEL}"
echo "      ✓ Package created: ${PACKAGE_FILE}"
echo ""

# ── Step 3: Install on all 3 orgs ───────────────────────────────────────────
echo "[3/6] Installing chaincode on all peers..."
for ORG in 1 2 3; do
  set_peer_env "${ORG}"
  echo "      Installing on Org${ORG} (${CORE_PEER_LOCALMSPID})..."
  peer lifecycle chaincode install "${PACKAGE_FILE}"
  echo "      ✓ Installed on Org${ORG}"
done
echo ""

# ── Step 4: Get package ID ───────────────────────────────────────────────────
echo "[4/6] Querying package ID..."
set_peer_env 1
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled 2>&1 | grep "${CHAINCODE_LABEL}" | awk -F 'Package ID: ' '{print $2}' | awk -F ',' '{print $1}')

if [ -z "${PACKAGE_ID}" ]; then
  echo "ERROR: Could not retrieve package ID for label '${CHAINCODE_LABEL}'"
  echo "  Installed chaincodes:"
  peer lifecycle chaincode queryinstalled
  exit 1
fi

echo "      ✓ Package ID: ${PACKAGE_ID}"
echo ""

# ── Step 5: Approve for all 3 orgs ──────────────────────────────────────────
echo "[5/6] Approving chaincode for all organisations..."
for ORG in 1 2 3; do
  set_peer_env "${ORG}"
  echo "      Approving for Org${ORG} (${CORE_PEER_LOCALMSPID})..."
  peer lifecycle chaincode approveformyorg \
    -o "${ORDERER_ADDRESS}" \
    --ordererTLSHostnameOverride orderer.example.com \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --package-id "${PACKAGE_ID}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --tls \
    --cafile "${ORDERER_CA}"
  echo "      ✓ Approved for Org${ORG}"
done
echo ""

# ── Step 6: Check commit readiness and commit ───────────────────────────────
echo "[6/6] Committing chaincode to channel..."

# Check readiness
set_peer_env 1
echo "      Checking commit readiness..."
peer lifecycle chaincode checkcommitreadiness \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --version "${CHAINCODE_VERSION}" \
  --sequence "${CHAINCODE_SEQUENCE}" \
  --tls \
  --cafile "${ORDERER_CA}" \
  --output json

# Commit with endorsement from Org1 and Org2 (majority)
echo ""
echo "      Committing..."
peer lifecycle chaincode commit \
  -o "${ORDERER_ADDRESS}" \
  --ordererTLSHostnameOverride orderer.example.com \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --version "${CHAINCODE_VERSION}" \
  --sequence "${CHAINCODE_SEQUENCE}" \
  --tls \
  --cafile "${ORDERER_CA}" \
  --peerAddresses "${ORG1_PEER_ADDRESS}" \
  --tlsRootCertFiles "${ORG1_TLS_ROOTCERT}" \
  --peerAddresses "${ORG2_PEER_ADDRESS}" \
  --tlsRootCertFiles "${ORG2_TLS_ROOTCERT}" \
  --peerAddresses "${ORG3_PEER_ADDRESS}" \
  --tlsRootCertFiles "${ORG3_TLS_ROOTCERT}"

echo "      ✓ Chaincode committed"
echo ""

# ── Verify deployment ───────────────────────────────────────────────────────
echo "──── Deployment Summary ────"
echo "  Chaincode:  ${CHAINCODE_NAME}"
echo "  Version:    ${CHAINCODE_VERSION}"
echo "  Sequence:   ${CHAINCODE_SEQUENCE}"
echo "  Channel:    ${CHANNEL_NAME}"
echo "  Package ID: ${PACKAGE_ID}"
echo ""
echo "  Committed chaincodes on channel:"
peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CHAINCODE_NAME}" --tls --cafile "${ORDERER_CA}"
echo ""
echo "============================================================"
echo "  Chaincode deployed successfully!"
echo "============================================================"
