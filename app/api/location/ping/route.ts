/**
 * POST /api/location/ping
 *
 * Called by the React Native mobile app every 30 seconds.
 * Records GPS position and checks for geofence breaches.
 *
 * Returns: { ok: true, breach: null | BreachResult }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';
import { checkGeofenceBreach } from '@/lib/geofence';
import { safePublish } from '@/lib/redis';
import { addFabricJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { lat, lng, accuracy } = body;

    // ── Validate coordinates ──────────────────────────────────────────────
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      return badRequest('lat must be a number between -90 and 90');
    }
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      return badRequest('lng must be a number between -180 and 180');
    }

    // ── Record location ───────────────────────────────────────────────────
    await db.query(
      `INSERT INTO tourist_locations (tourist_id, lat, lng, accuracy, recorded_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [user.id, lat, lng, accuracy ?? null],
    );

    // ── Check geofence breach ─────────────────────────────────────────────
    const breach = await checkGeofenceBreach(user.id, lat, lng);

    if (breach) {
      // Insert breach event
      const breachResult = await db.query(
        `INSERT INTO breach_events (tourist_id, lat, lng, zone_id, severity, breached_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [user.id, lat, lng, breach.zoneId === 'unknown_zone' ? null : breach.zoneId, breach.severity],
      );
      const breachId = breachResult.rows[0]?.id;

      // Get tourist display name for alert
      const touristData = await db.query(
        'SELECT full_name, kyc_verified FROM tourists WHERE id = $1',
        [user.id],
      );
      const displayName = touristData.rows[0]?.full_name ?? 'no_name_available';

      // Publish real-time alert
      await safePublish('geofence:breach', {
        touristId: user.id,
        displayName,
        lat,
        lng,
        severity: breach.severity,
        zoneName: breach.zoneName,
        distanceMeters: breach.distanceMeters,
        durationOutside: 0,
        timestamp: new Date().toISOString(),
      });

      // Queue blockchain job
      await addFabricJob('GEOFENCE_BREACH', {
        breachId,
        touristId: user.id,
        lat,
        lng,
        zoneId: breach.zoneId,
        zoneName: breach.zoneName,
        severity: breach.severity,
        distanceMeters: breach.distanceMeters,
      });
    }

    return success({ ok: true, breach: breach ?? null });
  } catch (error) {
    console.error('[/api/location/ping] Error:', error);
    return badRequest('Location ping failed');
  }
}
