/**
 * GET /api/services/analytics — Aggregated zone analytics
 *
 * Returns aggregate data only — no individual tourist data ever.
 * Available to: insurance, tourism_board, government service accounts.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = requireRole(req, 'service', 'admin');
  if (!user) return forbidden('Service account access required');

  try {
    // Zone-level aggregations (last 30 days)
    const zones = await db.query(
      `SELECT gz.id, gz.name, gz.severity,
              COUNT(DISTINCT be.id)::int AS breach_count,
              COUNT(DISTINCT se.id)::int AS sos_count
       FROM geofence_zones gz
       LEFT JOIN breach_events be ON be.zone_id = gz.id
         AND be.breached_at > NOW() - INTERVAL '30 days'
       LEFT JOIN sos_events se ON se.confirmed_at > NOW() - INTERVAL '30 days'
         AND se.status = 'confirmed'
       WHERE gz.active = true
       GROUP BY gz.id, gz.name, gz.severity`,
    );

    // Overall stats
    const stats = await db.query(
      `SELECT
         (SELECT COUNT(DISTINCT tourist_id)::int FROM tourist_locations
          WHERE recorded_at > NOW() - INTERVAL '24 hours') AS tourists_today,
         (SELECT COUNT(*)::int FROM sos_events
          WHERE confirmed_at > NOW() - INTERVAL '30 days') AS sos_30d,
         (SELECT COUNT(*)::int FROM breach_events
          WHERE breached_at > NOW() - INTERVAL '30 days') AS breaches_30d,
         (SELECT COUNT(*)::int FROM tourists
          WHERE role = 'tourist') AS total_tourists`,
    );

    const s = stats.rows[0];
    const breachRate = s.total_tourists > 0
      ? ((s.breaches_30d / s.total_tourists) * 100).toFixed(1)
      : '0.0';

    return success({
      overview: {
        touristsToday: s.tourists_today,
        sosEventsLast30d: s.sos_30d,
        breachesLast30d: s.breaches_30d,
        breachRatePercent: parseFloat(breachRate),
        totalRegistered: s.total_tourists,
      },
      zones: zones.rows.map((z) => ({
        id: z.id,
        name: z.name,
        severity: z.severity,
        breachCount: z.breach_count,
        sosCount: z.sos_count,
      })),
      _privacyNote:
        'Individual tourist IDs, GPS tracks, and KYC data are never included in analytics.',
    });
  } catch (error) {
    console.error('[/api/services/analytics] Error:', error);
    return badRequest('Failed to fetch analytics');
  }
}
