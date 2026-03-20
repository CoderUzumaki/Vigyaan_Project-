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

    // ── Find user ─────────────────────────────────────────────────────────
    const result = await db.query(
      `SELECT id, email, password_hash, full_name, did, role,
              kyc_status, kyc_verified, insurance_consent, created_at
       FROM tourists
       WHERE email = $1`,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return unauthorized('Invalid email or password');
    }

    const user = result.rows[0];

    // ── Verify password ───────────────────────────────────────────────────
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return unauthorized('Invalid email or password');
    }

    // ── Sign JWT ──────────────────────────────────────────────────────────
    const token = signToken({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      did: user.did,
      role: user.role,
      kycStatus: user.kyc_status,
      kycVerified: user.kyc_verified,
    });

    // ── Update last login ─────────────────────────────────────────────────
    await db.query(
      'UPDATE tourists SET updated_at = NOW() WHERE id = $1',
      [user.id],
    );

    return success({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        did: user.did,
        role: user.role,
        kycStatus: user.kyc_status,
        kycVerified: user.kyc_verified,
        insuranceConsent: user.insurance_consent,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('[/api/auth/login] Error:', error);
    return badRequest('Login failed');
  }
}
