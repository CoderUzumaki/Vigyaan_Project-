/**
 * lib/redis.ts — Redis client singleton
 *
 * Handles connect/disconnect lifecycle with hot-reload safety.
 * Used by: SOS duplicate locks, pub/sub notifications, geofence alerts.
 */

import { createClient, type RedisClientType } from 'redis';
import { config } from './config';

const REDIS_URL = config.redisUrl;

const globalForRedis = globalThis as unknown as { redisClient?: RedisClientType };

function createRedisClient(): RedisClientType {
  const client = createClient({ url: REDIS_URL }) as RedisClientType;

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  return client;
}

export const redis: RedisClientType =
  globalForRedis.redisClient ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redis;
}

/** Ensure Redis is connected before use */
export async function ensureRedisConnected(): Promise<void> {
  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (err) {
      console.error('[Redis] Failed to connect:', err);
    }
  }
}

/**
 * Safe Redis publish — won't throw if Redis is down.
 * Returns true if published, false if skipped.
 */
export async function safePublish(
  channel: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    await ensureRedisConnected();
    if (redis.isOpen) {
      await redis.publish(channel, JSON.stringify(payload));
      return true;
    }
  } catch (err) {
    console.error(`[Redis] Publish to ${channel} failed:`, err);
  }
  return false;
}

/**
 * Safe Redis SET with NX (used for SOS duplicate locks).
 * Returns true if key was set, false if already exists or Redis is down.
 */
export async function safeLock(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    await ensureRedisConnected();
    if (redis.isOpen) {
      const result = await redis.set(key, '1', { NX: true, EX: ttlSeconds });
      return result === 'OK';
    }
  } catch (err) {
    console.error(`[Redis] Lock ${key} failed:`, err);
  }
  return false;
}

/**
 * Safe Redis DEL.
 */
export async function safeUnlock(key: string): Promise<void> {
  try {
    if (redis.isOpen) {
      await redis.del(key);
    }
  } catch (err) {
    console.error(`[Redis] Unlock ${key} failed:`, err);
  }
}
