/**
 * POST /api/auth/login
 *
 * Authenticate an existing user.
 * Returns JWT token + user profile.
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signToken, badRequest, unauthorized, success } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!email || typeof email !== 'string') {
      return badRequest('Email is required');
    }
    if (!password || typeof password !== 'string') {
      return badRequest('Password is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Try tourists table first ───────────────────────────────────────────
    const touristResult = await db.query(
      `SELECT id, email, password_hash, full_name, did, role,
              kyc_status, kyc_verified, insurance_consent, created_at
       FROM tourists
       WHERE email = $1`,
      [normalizedEmail],
    );

    if (touristResult.rows.length > 0) {
      const user = touristResult.rows[0];

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) return unauthorized('Invalid email or password');

      const token = signToken({
        id: user.id,
        email: user.email,
        fullName: user.full_name ?? 'no_name_available',
        did: user.did ?? 'no_did_available',
        role: user.role,
        kycStatus: user.kyc_status ?? 'pending',
        kycVerified: user.kyc_verified ?? false,
      });

      await db.query('UPDATE tourists SET updated_at = NOW() WHERE id = $1', [user.id]);

      return success({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name ?? 'no_name_available',
          did: user.did ?? 'no_did_available',
          role: user.role,
          kycStatus: user.kyc_status ?? 'pending',
          kycVerified: user.kyc_verified ?? false,
          insuranceConsent: user.insurance_consent ?? false,
          createdAt: user.created_at,
        },
      });
    }

    // ── Fall through to service_accounts table ────────────────────────────
    const serviceResult = await db.query(
      `SELECT id, email, password_hash, org_name, org_type, api_key, active, created_at
       FROM service_accounts
       WHERE email = $1`,
      [normalizedEmail],
    );

    if (serviceResult.rows.length === 0) {
      return unauthorized('Invalid email or password');
    }

    const svc = serviceResult.rows[0];

    if (!svc.active) {
      return unauthorized('Service account is deactivated');
    }

    const isValid = await bcrypt.compare(password, svc.password_hash);
    if (!isValid) return unauthorized('Invalid email or password');

    const token = signToken({
      id: svc.id,
      email: svc.email,
      fullName: svc.org_name ?? 'no_org_name_available',
      role: 'service',
      did: `did:fab:service:${svc.id}`,
      kycStatus: 'verified',
      kycVerified: true,
    });

    return success({
      token,
      user: {
        id: svc.id,
        email: svc.email,
        orgName: svc.org_name ?? 'no_org_name_available',
        orgType: svc.org_type ?? 'no_org_type',
        role: 'service' as const,
        apiKey: svc.api_key,
        createdAt: svc.created_at,
      },
    });
  } catch (error) {
    console.error('[/api/auth/login] Error:', error);
    return badRequest('Login failed');
  }
}
