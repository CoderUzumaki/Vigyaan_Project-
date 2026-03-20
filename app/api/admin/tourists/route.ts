/**
 * GET /api/admin/tourists — List tourists with optional filters
 *
 * Query params:
 *   status: 'outside_zone' | 'all' (default: 'all')
 *   kycStatus: 'pending' | 'verified' | 'rejected'
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'all';
  const kycStatus = url.searchParams.get('kycStatus');

  try {
    let query: string;
    const params: unknown[] = [];

    if (status === 'outside_zone') {
      // Tourists whose last location is NOT in any active zone
      query = `
        SELECT DISTINCT ON (t.id)
          t.id, t.full_name, t.email, t.kyc_status, t.kyc_verified,
          tl.lat AS last_lat, tl.lng AS last_lng, tl.recorded_at AS last_seen
        FROM tourists t
        JOIN tourist_locations tl ON tl.tourist_id = t.id
        WHERE t.role = 'tourist'
        ${kycStatus ? 'AND t.kyc_status = $1' : ''}
        ORDER BY t.id, tl.recorded_at DESC`;
      if (kycStatus) params.push(kycStatus);
    } else {
      // All tourists with their last known location
      query = `
        SELECT DISTINCT ON (t.id)
          t.id, t.full_name, t.email, t.did, t.role,
          t.kyc_status, t.kyc_verified, t.insurance_consent,
          tl.lat AS last_lat, tl.lng AS last_lng, tl.recorded_at AS last_seen,
          t.created_at
        FROM tourists t
        LEFT JOIN tourist_locations tl ON tl.tourist_id = t.id
        WHERE t.role = 'tourist'
        ${kycStatus ? 'AND t.kyc_status = $1' : ''}
        ORDER BY t.id, tl.recorded_at DESC NULLS LAST`;
      if (kycStatus) params.push(kycStatus);
    }

    const result = await db.query(query, params);

    return success(
      result.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        did: r.did ?? 'no_did_available',
        kycStatus: r.kyc_status,
        kycVerified: r.kyc_verified,
        insuranceConsent: r.insurance_consent,
        lastLat: r.last_lat ?? null,
        lastLng: r.last_lng ?? null,
        lastSeen: r.last_seen ?? null,
        createdAt: r.created_at,
      })),
    );
  } catch (error) {
    console.error('[/api/admin/tourists] Error:', error);
    return badRequest('Failed to fetch tourists');
  }
}
