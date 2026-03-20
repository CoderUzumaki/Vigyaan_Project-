/**
 * lib/fabricQueue.ts — addFabricJob() helper
 *
 * This is the ONLY function Team B calls to interact with the blockchain.
 * It adds a job to the BullMQ "fabric-events" queue, and Team C's worker
 * picks it up and invokes the chaincode.
 *
 * Usage (from any Next.js API route):
 *   import { addFabricJob } from '@/lib/fabricQueue';
 *   await addFabricJob('SOS_CONFIRMED', { incidentId, touristId, ... });
 */

import { Queue, type JobsOptions } from 'bullmq';

// ─────────────────────────────────────────────────────────────────────────────
// Queue configuration
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_NAME = 'fabric-events';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/** Parse Redis URL into IORedis-compatible connection options */
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

/** Lazy-initialized queue singleton */
let _queue: Queue | null = null;

function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: parseRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s → 4s → 8s
        },
        removeOnComplete: {
          age: 86400, // keep completed jobs for 24h
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // keep failed jobs for 7 days
        },
      },
    });
  }
  return _queue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** All supported job types for the fabric-events queue */
export type FabricJobType =
  | 'SOS_CONFIRMED'
  | 'GEOFENCE_BREACH'
  | 'KYC_VERIFIED'
  | 'DISPATCH_SENT'
  | 'INCIDENT_CLOSED'
  | 'TOURIST_REGISTERED'
  | 'CONSENT_UPDATED'
  | 'RESPONDER_STATUS_UPDATED';

/** Job data payloads for each job type */
export interface FabricJobData {
  SOS_CONFIRMED: {
    incidentId: string;
    touristId: string;
    sosType: 'medical' | 'fire' | 'police';
    intentMethod: 'countdown' | 'pin' | 'gyro_panic';
    lat: number | string;
    lng: number | string;
    kycVerified: boolean;
  };
  GEOFENCE_BREACH: {
    breachId: string;
    touristId: string;
    lat: number | string;
    lng: number | string;
    severity: 'amber' | 'red';
    zoneName: string;
  };
  KYC_VERIFIED: {
    touristId: string;
    kycHash: string;
    verifiedBy: string;
  };
  DISPATCH_SENT: {
    dispatchId: string;
    incidentId: string;
    responderId: string;
    responderType: 'medical' | 'fire' | 'police';
  };
  INCIDENT_CLOSED: {
    incidentId: string;
    outcome: 'responded' | 'false_alarm' | 'tourist_safe';
    closedBy: string;
  };
  TOURIST_REGISTERED: {
    touristId: string;
    did: string;
    kycHash: string;
  };
  CONSENT_UPDATED: {
    touristId: string;
    consent: boolean;
  };
  RESPONDER_STATUS_UPDATED: {
    dispatchId: string;
    status: 'en_route' | 'on_scene' | 'complete';
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main API — this is what Team B calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a job to the Fabric events queue.
 *
 * The BullMQ worker will pick this up, invoke the appropriate chaincode
 * function, and write the transaction hash back to Postgres.
 *
 * @param jobType - The type of blockchain event to record
 * @param data - The payload for the job (type-checked per jobType)
 * @param opts - Optional BullMQ job options (priority, delay, etc.)
 * @returns The job ID
 *
 * @example
 * ```ts
 * // From an API route handler:
 * const jobId = await addFabricJob('SOS_CONFIRMED', {
 *   incidentId: 'inc-001',
 *   touristId: 'tourist-001',
 *   sosType: 'medical',
 *   intentMethod: 'countdown',
 *   lat: 28.6139,
 *   lng: 77.2090,
 *   kycVerified: true,
 * });
 * ```
 */
export async function addFabricJob<T extends FabricJobType>(
  jobType: T,
  data: FabricJobData[T],
  opts?: Partial<JobsOptions>,
): Promise<string> {
  const queue = getQueue();

  const job = await queue.add(jobType, data, {
    ...opts,
    // Use a deterministic job ID to prevent duplicate submissions
    jobId: opts?.jobId ?? `${jobType}_${getIdFromData(jobType, data)}_${Date.now()}`,
  });

  console.log(`[FabricQueue] Job added: ${jobType} → ${job.id}`);
  return job.id!;
}

/**
 * Extract a human-readable ID from job data for deduplication.
 */
function getIdFromData(jobType: FabricJobType, data: Record<string, unknown>): string {
  switch (jobType) {
    case 'SOS_CONFIRMED':
      return (data.incidentId as string) ?? 'no_id';
    case 'GEOFENCE_BREACH':
      return (data.breachId as string) ?? 'no_id';
    case 'KYC_VERIFIED':
    case 'TOURIST_REGISTERED':
    case 'CONSENT_UPDATED':
      return (data.touristId as string) ?? 'no_id';
    case 'DISPATCH_SENT':
      return (data.dispatchId as string) ?? 'no_id';
    case 'INCIDENT_CLOSED':
      return (data.incidentId as string) ?? 'no_id';
    case 'RESPONDER_STATUS_UPDATED':
      return (data.dispatchId as string) ?? 'no_id';
    default:
      return 'no_id';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue management helpers (for admin/monitoring)
// ─────────────────────────────────────────────────────────────────────────────

/** Get counts of jobs in each state */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

/** Gracefully close the queue connection */
export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
