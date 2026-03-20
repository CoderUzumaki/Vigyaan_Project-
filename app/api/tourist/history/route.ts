/**
 * GET /api/tourist/history
 *
 * Returns the authenticated tourist's SOS and breach event history.
 * Last 20 of each, ordered by most recent first.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    // SOS history
    const sosResult = await db.query(
      `SELECT id, sos_type, intent_method, lat, lng, status, outcome,
              fabric_tx_hash, confirmed_at, cancelled_at, closed_at, created_at
       FROM sos_events
       WHERE tourist_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.id],
    );

    // Breach history
    const breachResult = await db.query(
      `SELECT be.id, be.lat, be.lng, be.severity,
              gz.name AS zone_name, gz.id AS zone_id,
              be.fabric_tx_hash, be.breached_at, be.resolved_at
       FROM breach_events be
       LEFT JOIN geofence_zones gz ON be.zone_id = gz.id
       WHERE be.tourist_id = $1
       ORDER BY be.breached_at DESC
       LIMIT 20`,
      [user.id],
    );

    return success({
      sos: sosResult.rows.map((row) => ({
        id: row.id,
        sosType: row.sos_type,
        intentMethod: row.intent_method,
        lat: row.lat,
        lng: row.lng,
        status: row.status,
        outcome: row.outcome ?? 'no_outcome',
        fabricTxHash: row.fabric_tx_hash ?? 'pending',
        confirmedAt: row.confirmed_at,
        cancelledAt: row.cancelled_at,
        closedAt: row.closed_at,
        createdAt: row.created_at,
      })),
      breaches: breachResult.rows.map((row) => ({
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        severity: row.severity,
        zoneName: row.zone_name ?? 'no_zone_available',
        zoneId: row.zone_id ?? 'no_zone_available',
        fabricTxHash: row.fabric_tx_hash ?? 'pending',
        breachedAt: row.breached_at,
        resolvedAt: row.resolved_at,
      })),
    });
  } catch (error) {
    console.error('[/api/tourist/history] Error:', error);
    return badRequest('Failed to fetch history');
  }
}
