/**
 * GET /api/kyc/pending — Admin only: list pending KYC submissions
 * GET /api/kyc/status — Tourist: check own KYC status
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRole, unauthorized, forbidden, badRequest, success } from '@/lib/auth';

// ── GET /api/kyc/pending — admin only ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const isPending = url.pathname.endsWith('/pending');

  if (isPending) {
    const admin = requireRole(req, 'admin');
    if (!admin) return forbidden('Admin access required');

    try {
      const result = await db.query(
        `SELECT ks.id, ks.tourist_id, ks.passport_path, ks.selfie_path,
                ks.face_match_score, ks.status, ks.submitted_at,
                t.full_name, t.email, t.did
         FROM kyc_submissions ks
         JOIN tourists t ON t.id = ks.tourist_id
         WHERE ks.status = 'pending'
         ORDER BY ks.submitted_at ASC`,
      );
      return success(result.rows);
    } catch (error) {
      console.error('[/api/kyc/pending] Error:', error);
      return badRequest('Failed to fetch pending submissions');
    }
  }

  // Default: tourist KYC status
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const result = await db.query(
      'SELECT kyc_status, kyc_verified FROM tourists WHERE id = $1',
      [user.id],
    );
    const row = result.rows[0];
    return success({
      kycStatus: row?.kyc_status ?? 'no_data',
      kycVerified: row?.kyc_verified ?? false,
    });
  } catch (error) {
    console.error('[/api/kyc/status] Error:', error);
    return badRequest('Failed to fetch KYC status');
  }
}
