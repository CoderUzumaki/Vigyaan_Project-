/**
 * POST /api/sos/cancel
 *
 * Cancel an active SOS alert.
 * If incidentId provided: cancel that specific incident.
 * If no incidentId: cancel the most recent confirmed SOS for this tourist.
 *
 * Also monitors for high cancel rates (≥3 in 24h) and publishes warnings.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';
import { safeUnlock, safePublish } from '@/lib/redis';

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { incidentId } = body;

    let cancelResult;

    if (incidentId) {
      // Cancel specific incident
      cancelResult = await db.query(
        `UPDATE sos_events
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE id = $1 AND tourist_id = $2 AND status = 'confirmed'
         RETURNING id`,
        [incidentId, user.id],
      );

      if (cancelResult.rows.length === 0) {
        return badRequest('Incident not found or already cancelled');
      }
    } else {
      // Cancel most recent confirmed SOS
      cancelResult = await db.query(
        `UPDATE sos_events
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE tourist_id = $1 AND status = 'confirmed'
         AND id = (
           SELECT id FROM sos_events
           WHERE tourist_id = $1 AND status = 'confirmed'
           ORDER BY created_at DESC LIMIT 1
         )
         RETURNING id`,
        [user.id],
      );

      if (cancelResult.rows.length === 0) {
        return badRequest('No active SOS to cancel');
      }
    }

    // Release Redis lock
    await safeUnlock(`sos:lock:${user.id}`);

    // ── High cancel rate check ────────────────────────────────────────────
    const cancelCount = await db.query(
      `SELECT COUNT(*)::int AS count FROM sos_events
       WHERE tourist_id = $1 AND status = 'cancelled'
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [user.id],
    );

    const count = cancelCount.rows[0]?.count ?? 0;
    if (count >= 3) {
      // Get tourist name
      const touristData = await db.query(
        'SELECT full_name FROM tourists WHERE id = $1',
        [user.id],
      );
      const displayName = touristData.rows[0]?.full_name ?? 'no_name_available';

      await safePublish('beacon:missed', {
        type: 'high_cancel_rate',
        touristId: user.id,
        displayName,
        cancelCount: count,
        message: `Tourist has cancelled SOS ${count} times in 24h`,
        timestamp: new Date().toISOString(),
      });
    }

    return success({ ok: true, cancelledId: cancelResult.rows[0]?.id ?? null });
  } catch (error) {
    console.error('[/api/sos/cancel] Error:', error);
    return badRequest('SOS cancellation failed');
  }
}
