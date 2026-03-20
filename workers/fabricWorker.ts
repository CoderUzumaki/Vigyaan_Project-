/**
 * workers/fabricWorker.ts — BullMQ Worker Process
 *
 * Consumes jobs from the "fabric-events" Redis queue and invokes
 * the corresponding chaincode function on the Fabric network.
 *
 * For each job:
 * 1. Calls the appropriate lib/fabric.ts helper → submits to ledger
 * 2. Writes the Fabric tx hash back to Postgres
 * 3. Publishes a Redis notification (for WebSocket relay to clients)
 *
 * DO NOT import this file from Next.js — it runs as a separate process.
 */

import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import { createClient, type RedisClientType } from 'redis';
import {
  logSOSOnChain,
  logBreachOnChain,
  verifyKYCOnChain,
  logDispatchOnChain,
  closeIncidentOnChain,
  registerTouristOnChain,
  setConsentOnChain,
  updateResponderStatusOnChain,
} from '../lib/fabric';
import { config } from '../lib/config';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const REDIS_URL = config.redisUrl;
const DATABASE_URL = config.databaseUrl;
const QUEUE_NAME = config.fabricQueueName;
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '3', 10);

/** Parse Redis URL into connection options */
function parseRedisConnection(): { host: string; port: number; password?: string } {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database and Redis clients
// ─────────────────────────────────────────────────────────────────────────────

const db = new Pool({ connectionString: DATABASE_URL });
const redis: RedisClientType = createClient({ url: REDIS_URL }) as RedisClientType;

// ─────────────────────────────────────────────────────────────────────────────
// Job Handlers — one per event type
// ─────────────────────────────────────────────────────────────────────────────

type JobHandler = (job: Job) => Promise<void>;

const handlers: Record<string, JobHandler> = {

  /**
   * SOS_CONFIRMED — Tourist confirmed an SOS alert.
   * 1. Write SOS event to ledger via Org A
   * 2. Update Postgres with tx hash
   * 3. Publish confirmation to Redis (→ WebSocket → mobile app)
   */
  SOS_CONFIRMED: async (job: Job) => {
    const { incidentId, touristId, sosType, intentMethod, lat, lng, kycVerified } = job.data;
    console.log(`[Worker] Processing SOS_CONFIRMED for incident ${incidentId}`);

    const txId = await logSOSOnChain(
      incidentId,
      touristId,
      sosType,
      intentMethod,
      String(lat),
      String(lng),
      Boolean(kycVerified),
    );

    // Write tx hash back to Postgres
    await db.query(
      'UPDATE sos_events SET fabric_tx_hash = $1, fabric_pending = false WHERE id = $2',
      [txId || `tx_${Date.now()}`, incidentId],
    );

    // Notify via Redis pub/sub → WebSocket relay
    await publishNotification('sos:confirmed', {
      touristId,
      incidentId,
      txId,
      message: 'Your emergency has been recorded on the blockchain',
    });

    console.log(`[Worker] SOS_CONFIRMED complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * GEOFENCE_BREACH — Tourist entered a restricted zone.
   */
  GEOFENCE_BREACH: async (job: Job) => {
    const { breachId, touristId, lat, lng, severity, zoneName } = job.data;
    console.log(`[Worker] Processing GEOFENCE_BREACH ${breachId}`);

    const txId = await logBreachOnChain(
      breachId,
      touristId,
      String(lat),
      String(lng),
      severity,
      zoneName,
    );

    await db.query(
      'UPDATE breach_events SET fabric_tx_hash = $1, fabric_pending = false WHERE id = $2',
      [txId || `tx_${Date.now()}`, breachId],
    );

    await publishNotification('breach:logged', { breachId, touristId, txId });

    console.log(`[Worker] GEOFENCE_BREACH complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * KYC_VERIFIED — Admin verified a tourist's KYC documents.
   */
  KYC_VERIFIED: async (job: Job) => {
    const { touristId, kycHash, verifiedBy } = job.data;
    console.log(`[Worker] Processing KYC_VERIFIED for tourist ${touristId}`);

    const txId = await verifyKYCOnChain(touristId, kycHash, verifiedBy);

    await db.query(
      'UPDATE tourists SET fabric_tx_hash = $1 WHERE id = $2',
      [txId || `tx_${Date.now()}`, touristId],
    );

    await publishNotification('kyc:verified', { touristId, txId });

    console.log(`[Worker] KYC_VERIFIED complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * DISPATCH_SENT — Emergency responder dispatched to an incident.
   */
  DISPATCH_SENT: async (job: Job) => {
    const { dispatchId, incidentId, responderId, responderType } = job.data;
    console.log(`[Worker] Processing DISPATCH_SENT ${dispatchId}`);

    const txId = await logDispatchOnChain(dispatchId, incidentId, responderId, responderType);

    await db.query(
      'UPDATE dispatch_events SET fabric_tx_hash = $1 WHERE id = $2',
      [txId || `tx_${Date.now()}`, dispatchId],
    );

    await publishNotification('dispatch:sent', { dispatchId, incidentId, txId });

    console.log(`[Worker] DISPATCH_SENT complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * INCIDENT_CLOSED — SOS incident resolved with an outcome.
   */
  INCIDENT_CLOSED: async (job: Job) => {
    const { incidentId, outcome, closedBy } = job.data;
    console.log(`[Worker] Processing INCIDENT_CLOSED ${incidentId}`);

    const txId = await closeIncidentOnChain(incidentId, outcome, closedBy);

    await db.query(
      'UPDATE sos_events SET fabric_tx_hash = $1, fabric_pending = false WHERE id = $2',
      [txId || `tx_${Date.now()}`, incidentId],
    );

    await publishNotification('incident:closed', { incidentId, outcome, txId });

    console.log(`[Worker] INCIDENT_CLOSED complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * TOURIST_REGISTERED — New tourist registered in the system.
   */
  TOURIST_REGISTERED: async (job: Job) => {
    const { touristId, did, kycHash } = job.data;
    console.log(`[Worker] Processing TOURIST_REGISTERED ${touristId}`);

    const txId = await registerTouristOnChain(touristId, did, kycHash);

    await db.query(
      'UPDATE tourists SET fabric_tx_hash = $1 WHERE id = $2',
      [txId || `tx_${Date.now()}`, touristId],
    );

    console.log(`[Worker] TOURIST_REGISTERED complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * CONSENT_UPDATED — Tourist updated their insurance data sharing consent.
   */
  CONSENT_UPDATED: async (job: Job) => {
    const { touristId, consent } = job.data;
    console.log(`[Worker] Processing CONSENT_UPDATED for ${touristId} → ${consent}`);

    const txId = await setConsentOnChain(touristId, Boolean(consent));

    await publishNotification('consent:updated', { touristId, consent, txId });

    console.log(`[Worker] CONSENT_UPDATED complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },

  /**
   * RESPONDER_STATUS_UPDATED — Responder status changed (en_route → on_scene → complete).
   */
  RESPONDER_STATUS_UPDATED: async (job: Job) => {
    const { dispatchId, status } = job.data;
    console.log(`[Worker] Processing RESPONDER_STATUS_UPDATED ${dispatchId} → ${status}`);

    const txId = await updateResponderStatusOnChain(dispatchId, status);

    await db.query(
      'UPDATE dispatch_events SET fabric_tx_hash = $1, status = $2 WHERE id = $3',
      [txId || `tx_${Date.now()}`, status, dispatchId],
    );

    await publishNotification('responder:status', { dispatchId, status, txId });

    console.log(`[Worker] RESPONDER_STATUS_UPDATED complete. TxID: ${txId || 'no_tx_id_returned'}`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: publish notifications via Redis pub/sub
// ─────────────────────────────────────────────────────────────────────────────

async function publishNotification(
  channel: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    if (redis.isOpen) {
      await redis.publish(channel, JSON.stringify(payload));
    }
  } catch (err) {
    console.error(`[Worker] Failed to publish to ${channel}:`, err);
    // Don't throw — notification failure shouldn't fail the job
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create and start the BullMQ worker
// ─────────────────────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const handler = handlers[job.name];
    if (!handler) {
      console.error(`[Worker] Unknown job type: ${job.name}`);
      throw new Error(`Unknown job type: ${job.name}`);
    }
    await handler(job);
  },
  {
    connection: parseRedisConnection(),
    concurrency: WORKER_CONCURRENCY,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Worker event listeners
// ─────────────────────────────────────────────────────────────────────────────

worker.on('completed', (job: Job) => {
  console.log(`[Worker] ✓ Job ${job.id} (${job.name}) completed`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Worker] ✗ Job ${job?.id} (${job?.name}) failed:`, err.message);

  // On final failure (exhausted all retries): log to error table
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    db.query(
      `INSERT INTO worker_errors (job_id, job_type, job_data, error_message, failed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [job.id, job.name, JSON.stringify(job.data), err.message],
    ).catch((dbErr) => {
      console.error('[Worker] Failed to log error to DB:', dbErr);
    });
  }
});

worker.on('error', (err: Error) => {
  console.error('[Worker] Worker error:', err.message);
});

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Worker] Received ${signal} — shutting down gracefully...`);

  try {
    await worker.close();
    console.log('[Worker] Worker closed');
  } catch (err) {
    console.error('[Worker] Error closing worker:', err);
  }

  try {
    await db.end();
    console.log('[Worker] Database pool closed');
  } catch (err) {
    console.error('[Worker] Error closing database:', err);
  }

  try {
    if (redis.isOpen) {
      await redis.quit();
      console.log('[Worker] Redis closed');
    }
  } catch (err) {
    console.error('[Worker] Error closing Redis:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await redis.connect();
    console.log('[Worker] Connected to Redis');
  } catch (err) {
    console.error('[Worker] Failed to connect to Redis:', err);
    console.log('[Worker] Continuing without Redis pub/sub — jobs will still process');
  }

  console.log(`[Worker] Fabric event worker started`);
  console.log(`[Worker]   Queue:       ${QUEUE_NAME}`);
  console.log(`[Worker]   Concurrency: ${WORKER_CONCURRENCY}`);
  console.log(`[Worker]   Redis:       ${REDIS_URL.replace(/\/\/.*:(.*)@/, '//***:***@')}`);
  console.log(`[Worker]   Database:    ${DATABASE_URL.replace(/\/\/.*:(.*)@/, '//***:***@')}`);
  console.log(`[Worker]   Job types:   ${Object.keys(handlers).join(', ')}`);
  console.log('[Worker] Listening for jobs...');
}

start().catch((err) => {
  console.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});

export { worker };
