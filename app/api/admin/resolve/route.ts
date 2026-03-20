/**
 * POST /api/admin/resolve — Resolve an SOS incident
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';
import { addFabricJob } from '@/lib/queue';

const VALID_OUTCOMES = ['responded', 'false_alarm', 'tourist_safe'];

export async function POST(req: NextRequest) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  try {
    const body = await req.json();
    const { incidentId, outcome } = body;

    if (!incidentId) return badRequest('incidentId is required');
    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return badRequest(`outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }

    const result = await db.query(
      `UPDATE sos_events SET outcome = $1, closed_at = NOW()
       WHERE id = $2 AND closed_at IS NULL
       RETURNING id`,
      [outcome, incidentId],
    );

    if (result.rows.length === 0) {
      return badRequest('Incident not found or already resolved');
    }

    await addFabricJob('INCIDENT_CLOSED', {
      incidentId,
      outcome,
      closedBy: admin.id,
    });

    return success({ ok: true });
  } catch (error) {
    console.error('[/api/admin/resolve] Error:', error);
    return badRequest('Failed to resolve incident');
  }
}
