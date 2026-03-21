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
    // ── Admin users — query the dedicated admins table ────────────────────
    if (authUser.role === 'admin') {
      const adminResult = await db.query(
        `SELECT id, email, full_name, username, admin_role, permissions,
                active, last_login_at, created_at, updated_at
         FROM admins
         WHERE id = $1`,
        [authUser.id],
      );

      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        return success({
          id: admin.id,
          email: admin.email,
          fullName: admin.full_name ?? 'no_name_available',
          username: admin.username ?? 'no_username',
          role: 'admin' as const,
          adminRole: admin.admin_role,
          permissions: admin.permissions ?? [],
          active: admin.active,
          lastLoginAt: admin.last_login_at ?? null,
          createdAt: admin.created_at,
          updatedAt: admin.updated_at,
        });
      }
    }

    // ── Service accounts ──────────────────────────────────────────────────
    if (authUser.role === 'service') {
      const svcResult = await db.query(
        `SELECT id, email, org_name, org_type, api_key, active, created_at
         FROM service_accounts
         WHERE id = $1`,
        [authUser.id],
      );

      if (svcResult.rows.length > 0) {
        const svc = svcResult.rows[0];
        return success({
          id: svc.id,
          email: svc.email,
          orgName: svc.org_name ?? 'no_org_name_available',
          orgType: svc.org_type ?? 'no_org_type',
          role: 'service' as const,
          apiKey: svc.api_key,
          active: svc.active,
          createdAt: svc.created_at,
        });
      }
    }

    // ── Tourist users — query tourists table ──────────────────────────────
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
      fullName: user.full_name ?? 'no_name_available',
      did: user.did ?? 'no_did_available',
      role: user.role,
      kycStatus: user.kyc_status ?? 'pending',
      kycVerified: user.kyc_verified ?? false,
      insuranceConsent: user.insurance_consent ?? false,
      hasPushToken: user.has_push_token ?? false,
      hasPin: user.has_pin ?? false,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('[/api/auth/me] Error:', error);
    return unauthorized('Failed to fetch profile');
  }
}
