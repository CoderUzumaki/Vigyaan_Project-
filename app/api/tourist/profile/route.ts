/**
 * GET /api/tourist/profile
 *
 * Returns the authenticated tourist's profile.
 * Never returns password_hash or pin_hash.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const result = await db.query(
      `SELECT id, email, full_name, did, role,
              kyc_status, kyc_verified, insurance_consent,
              push_token IS NOT NULL AS has_push_token,
              pin_hash IS NOT NULL AS has_pin,
              created_at, updated_at
       FROM tourists
       WHERE id = $1`,
      [user.id],
    );

    if (result.rows.length === 0) {
      return unauthorized('User not found');
    }

    const row = result.rows[0];

    return success({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      did: row.did,
      role: row.role,
      kycStatus: row.kyc_status,
      kycVerified: row.kyc_verified,
      insuranceConsent: row.insurance_consent,
      hasPushToken: row.has_push_token,
      hasPin: row.has_pin,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[/api/tourist/profile] Error:', error);
    return badRequest('Failed to fetch profile');
  }
}
