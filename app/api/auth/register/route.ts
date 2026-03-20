/**
 * POST /api/auth/register
 *
 * Register a new tourist account.
 * Returns JWT token + user profile.
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { signToken, badRequest, conflict, success } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName } = body;

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return badRequest('Valid email is required');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return badRequest('Password must be at least 8 characters');
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return badRequest('Full name is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Check email uniqueness ────────────────────────────────────────────
    const existing = await db.query(
      'SELECT id FROM tourists WHERE email = $1',
      [normalizedEmail],
    );
    if (existing.rows.length > 0) {
      return conflict('Email already registered');
    }

    // ── Hash password ─────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);

    // ── Generate DID ──────────────────────────────────────────────────────
    const did = `did:fab:tourist:${crypto.randomUUID()}`;

    // ── Insert tourist ────────────────────────────────────────────────────
    const result = await db.query(
      `INSERT INTO tourists (email, password_hash, full_name, did, role, kyc_status, kyc_verified)
       VALUES ($1, $2, $3, $4, 'tourist', 'pending', false)
       RETURNING id, email, full_name, did, role, kyc_status, kyc_verified, insurance_consent, created_at`,
      [normalizedEmail, passwordHash, fullName.trim(), did],
    );

    const user = result.rows[0];

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
    }, 201);
  } catch (error) {
    console.error('[/api/auth/register] Error:', error);
    return badRequest('Registration failed');
  }
}
