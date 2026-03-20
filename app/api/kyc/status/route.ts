/**
 * GET /api/kyc/status — Tourist: check own KYC status
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const result = await db.query(
      `SELECT t.kyc_status, t.kyc_verified,
              ks.status AS submission_status, ks.submitted_at,
              ks.rejection_reason
       FROM tourists t
       LEFT JOIN kyc_submissions ks ON ks.tourist_id = t.id
       WHERE t.id = $1`,
      [user.id],
    );
    const row = result.rows[0];
    return success({
      kycStatus: row?.kyc_status ?? 'no_data',
      kycVerified: row?.kyc_verified ?? false,
      submissionStatus: row?.submission_status ?? 'not_submitted',
      submittedAt: row?.submitted_at ?? null,
      rejectionReason: row?.rejection_reason ?? null,
    });
  } catch (error) {
    console.error('[/api/kyc/status] Error:', error);
    return badRequest('Failed to fetch KYC status');
  }
}
