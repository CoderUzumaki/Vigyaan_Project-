/**
 * GET /api/services/incident/[id] — Insurance incident lookup (consent-gated)
 *
 * NEVER returns: tourist name, GPS coordinates, DID, KYC data
 * Returns ONLY: incidentId, sosType, timestamp, severity, outcome, fabricTxHash
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = requireRole(req, 'service', 'admin');
  if (!user) return forbidden('Service account access required');

  const { id } = params;

  try {
    // Get incident + check tourist consent
    const result = await db.query(
      `SELECT se.id, se.sos_type, se.status, se.outcome,
              se.confirmed_at, se.closed_at, se.fabric_tx_hash, se.fabric_pending,
              t.insurance_consent, t.id AS tourist_id,
              gz.name AS zone_name, gz.severity AS zone_severity
       FROM sos_events se
       JOIN tourists t ON t.id = se.tourist_id
       LEFT JOIN breach_events be ON be.tourist_id = se.tourist_id
         AND be.breached_at BETWEEN se.confirmed_at - INTERVAL '5 minutes' AND se.confirmed_at + INTERVAL '5 minutes'
       LEFT JOIN geofence_zones gz ON gz.id = be.zone_id
       WHERE se.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return badRequest('Incident not found');
    }

    const row = result.rows[0];

    // Consent check
    if (!row.insurance_consent) {
      return success({
        error: 'Tourist consent not granted',
        message: 'This tourist has not enabled insurance data sharing. Contact the tourist to request consent.',
        consentGranted: false,
      });
    }

    // Return privacy-safe data ONLY
    return success({
      incidentId: row.id,
      sosType: row.sos_type,
      status: row.status,
      outcome: row.outcome ?? 'pending',
      confirmedAt: row.confirmed_at,
      closedAt: row.closed_at,
      zoneAtTime: row.zone_name ?? 'no_zone_data_available',
      zoneSeverity: row.zone_severity ?? 'no_data',
      fabricTxHash: row.fabric_tx_hash ?? 'pending_blockchain_confirmation',
      fabricPending: row.fabric_pending,
      consentGranted: true,
      // Explicitly document what is NOT returned
      _privacyNote: 'Tourist identity, GPS coordinates, DID, and KYC data are never exposed to service accounts.',
    });
  } catch (error) {
    console.error('[/api/services/incident] Error:', error);
    return badRequest('Failed to fetch incident');
  }
}
