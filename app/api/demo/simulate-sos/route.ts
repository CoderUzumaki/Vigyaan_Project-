/**
 * POST /api/demo/simulate-sos — Simulate an SOS alert for exhibition demos
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';
import { safePublish } from '@/lib/redis';
import { addFabricJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const tourist = await db.query(
      `SELECT id, full_name, kyc_verified FROM tourists
       WHERE role = 'tourist' AND kyc_verified = true
       ORDER BY RANDOM() LIMIT 1`,
    );
    if (tourist.rows.length === 0) return badRequest('No verified tourists in database');

    const t = tourist.rows[0];
    const sosTypes = ['medical', 'fire', 'police'];
    const sosType = sosTypes[Math.floor(Math.random() * sosTypes.length)];

    const loc = await db.query(
      `SELECT lat, lng FROM tourist_locations WHERE tourist_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [t.id],
    );
    const lat = loc.rows[0]?.lat ?? (28.60 + Math.random() * 0.03);
    const lng = loc.rows[0]?.lng ?? (77.19 + Math.random() * 0.04);

    const incident = await db.query(
      `INSERT INTO sos_events (tourist_id, sos_type, intent_method, lat, lng, kyc_verified, status, outcome, confirmed_at)
       VALUES ($1, $2, 'countdown', $3, $4, $5, 'confirmed', 'pending', NOW())
       RETURNING id`,
      [t.id, sosType, lat, lng, t.kyc_verified],
    );

    await safePublish('sos:alert', {
      incidentId: incident.rows[0].id,
      touristId: t.id,
      displayName: t.full_name,
      lat, lng, sosType,
      kycVerified: t.kyc_verified,
      intentMethod: 'countdown',
      timestamp: new Date().toISOString(),
      fabricPending: true,
      _demo: true,
    });

    await addFabricJob('SOS_CONFIRMED', {
      incidentId: incident.rows[0].id,
      touristId: t.id,
      sosType, lat, lng,
    });

    return success({ ok: true, incidentId: incident.rows[0].id, _demo: true });
  } catch (error) {
    console.error('[/api/demo/simulate-sos] Error:', error);
    return badRequest('SOS simulation failed');
  }
}
