/**
 * GET /api/admin/incidents — List SOS incidents with filters
 *
 * Query: status?, from? (ISO date), to? (ISO date)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`se.status = $${idx++}`);
      params.push(status);
    }
    if (from) {
      conditions.push(`se.created_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`se.created_at <= $${idx++}`);
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT se.id, se.sos_type, se.intent_method, se.lat, se.lng,
              se.status, se.outcome, se.fabric_tx_hash, se.fabric_pending,
              se.confirmed_at, se.cancelled_at, se.closed_at, se.created_at,
              t.id AS tourist_id, t.full_name, t.email, t.kyc_verified,
              de.id AS dispatch_id, de.responder_id, de.responder_type, de.status AS dispatch_status
       FROM sos_events se
       JOIN tourists t ON t.id = se.tourist_id
       LEFT JOIN dispatch_events de ON de.incident_id = se.id
       ${where}
       ORDER BY se.created_at DESC
       LIMIT 100`,
      params,
    );

    return success(
      result.rows.map((r) => ({
        id: r.id,
        sosType: r.sos_type,
        intentMethod: r.intent_method,
        lat: r.lat,
        lng: r.lng,
        status: r.status,
        outcome: r.outcome ?? 'pending',
        fabricTxHash: r.fabric_tx_hash ?? 'pending',
        fabricPending: r.fabric_pending,
        confirmedAt: r.confirmed_at,
        cancelledAt: r.cancelled_at,
        closedAt: r.closed_at,
        createdAt: r.created_at,
        tourist: {
          id: r.tourist_id,
          fullName: r.full_name,
          email: r.email,
          kycVerified: r.kyc_verified,
        },
        dispatch: r.dispatch_id
          ? {
              id: r.dispatch_id,
              responderId: r.responder_id,
              responderType: r.responder_type,
              status: r.dispatch_status,
            }
          : null,
      })),
    );
  } catch (error) {
    console.error('[/api/admin/incidents] Error:', error);
    return badRequest('Failed to fetch incidents');
  }
}
