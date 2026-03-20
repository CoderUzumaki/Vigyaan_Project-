/**
 * POST /api/admin/dispatch — Dispatch a responder to an SOS incident
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';
import { addFabricJob } from '@/lib/queue';

const VALID_TYPES = ['medical', 'fire', 'police'];

export async function POST(req: NextRequest) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  try {
    const body = await req.json();
    const { incidentId, responderId, responderType } = body;

    if (!incidentId) return badRequest('incidentId is required');
    if (!responderId) return badRequest('responderId is required');
    if (!responderType || !VALID_TYPES.includes(responderType)) {
      return badRequest(`responderType must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Verify incident exists
    const incident = await db.query('SELECT id FROM sos_events WHERE id = $1', [incidentId]);
    if (incident.rows.length === 0) return badRequest('Incident not found');

    const result = await db.query(
      `INSERT INTO dispatch_events (incident_id, responder_id, responder_type, dispatched_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [incidentId, responderId, responderType],
    );

    await addFabricJob('DISPATCH_SENT', {
      dispatchId: result.rows[0].id,
      incidentId,
      responderId,
      responderType,
    });

    return success({ ok: true, dispatchId: result.rows[0].id }, 201);
  } catch (error) {
    console.error('[/api/admin/dispatch] Error:', error);
    return badRequest('Failed to dispatch responder');
  }
}
