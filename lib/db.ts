/**
 * lib/db.ts — PostgreSQL connection pool (singleton)
 *
 * Usage:
 *   import { db } from '@/lib/db';
 *   const result = await db.query('SELECT * FROM tourists WHERE id = $1', [id]);
 */

import { Pool } from 'pg';
import { config } from './config';

const DATABASE_URL = config.databaseUrl;

// Singleton pool — reused across hot reloads in dev
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const db: Pool =
  globalForPg.pgPool ??
  (() => {
    console.log('[lib/db.ts] Creating a new Pool with connectionString:', DATABASE_URL);
    return new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  })();

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = db;
}

/**
 * Helper: query a single row or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await db.query(sql, params);
  return (result.rows[0] as T) ?? null;
}

/**
 * Helper: query multiple rows.
 */
export async function queryMany<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await db.query(sql, params);
  return result.rows as T[];
}
