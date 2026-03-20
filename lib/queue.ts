/**
 * lib/queue.ts — BullMQ job queue with stub logging
 *
 * Wraps addFabricJob() with console.log stub so the backend works
 * completely without the Fabric worker or Redis running.
 *
 * In production, jobs are picked up by workers/fabricWorker.ts.
 */

import { Queue, type JobsOptions } from 'bullmq';
import { config } from './config';

const QUEUE_NAME = config.fabricQueueName;
const REDIS_URL = config.redisUrl;

export type FabricJobType =
  | 'SOS_CONFIRMED'
  | 'GEOFENCE_BREACH'
  | 'KYC_VERIFIED'
  | 'DISPATCH_SENT'
  | 'INCIDENT_CLOSED'
  | 'TOURIST_REGISTERED'
  | 'CONSENT_UPDATED'
  | 'RESPONDER_STATUS_UPDATED';

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

/** Lazy-initialized queue singleton */
let _queue: Queue | null = null;

function getQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: parseRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return _queue;
}

/**
 * Add a job to the Fabric events queue.
 *
 * Always logs the job as a STUB so the backend works without the worker.
 * If Redis is available, the job is also enqueued for real processing.
 */
export async function addFabricJob(
  type: FabricJobType,
  data: Record<string, unknown>,
  opts?: Partial<JobsOptions>,
): Promise<string | null> {
  // Always log — backend works without Fabric running
  console.log(`[FABRIC STUB] Job enqueued: ${type}`, JSON.stringify(data));

  try {
    const queue = getQueue();
    const job = await queue.add(type, data, {
      ...opts,
      jobId: opts?.jobId ?? `${type}_${Date.now()}`,
    });
    console.log(`[Queue] Job added: ${type} → ${job.id}`);
    return job.id ?? null;
  } catch (err) {
    // Queue unavailable — that's fine, stub already logged
    console.warn(`[Queue] Failed to enqueue ${type} (Redis may be down):`, (err as Error).message);
    return null;
  }
}
