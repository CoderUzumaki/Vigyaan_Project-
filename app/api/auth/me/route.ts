/**
 * GET /api/auth/me
 *
 * Get the authenticated user's profile.
 * Requires: Authorization: Bearer <jwt>
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, success } from '@/lib/auth';

export async function GET(req: NextRequest) {
  // ── Verify JWT ────────────────────────────────────────────────────────
  const authUser = verifyAuth(req);
  if (!authUser) {
    return unauthorized('Invalid or missing token');
  }

  try {
    // ── Fetch fresh profile from DB ───────────────────────────────────────
    const result = await db.query(
      `SELECT id, email, full_name, did, role, kyc_status, kyc_verified,
              insurance_consent, push_token IS NOT NULL AS has_push_token,
              pin_hash IS NOT NULL AS has_pin, created_at, updated_at
       FROM tourists
       WHERE id = $1`,
      [authUser.id],
    );

    if (result.rows.length === 0) {
      return unauthorized('User not found');
    }

    const user = result.rows[0];

    return success({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      did: user.did,
      role: user.role,
      kycStatus: user.kyc_status,
      kycVerified: user.kyc_verified,
      insuranceConsent: user.insurance_consent,
      hasPushToken: user.has_push_token,
      hasPin: user.has_pin,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('[/api/auth/me] Error:', error);
    return unauthorized('Failed to fetch profile');
  }
}
