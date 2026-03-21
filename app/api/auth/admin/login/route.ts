/**
 * POST /api/auth/admin/login
 *
 * Authenticate an admin user from the dedicated `admins` table.
 * Returns JWT token + admin profile.
 *
 * This endpoint is separate from /api/auth/login (which serves tourists/services).
 * Only accounts in the `admins` table can authenticate here.
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

    // ── Find admin in dedicated admins table ──────────────────────────────
    const result = await db.query(
      `SELECT id, email, password_hash, full_name, username,
              admin_role, permissions, active, last_login_at, created_at
       FROM admins
       WHERE email = $1`,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return unauthorized('Invalid email or password');
    }

    const admin = result.rows[0];

    // ── Check account is active ───────────────────────────────────────────
    if (!admin.active) {
      return unauthorized('Admin account is deactivated');
    }

    // ── Verify password ───────────────────────────────────────────────────
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return unauthorized('Invalid email or password');
    }

    // ── Sign JWT ──────────────────────────────────────────────────────────
    const token = signToken({
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name ?? 'no_name_available',
      role: 'admin',
      username: admin.username ?? 'no_username',
      adminRole: admin.admin_role,
      permissions: admin.permissions ?? [],
    });

    // ── Record last login ─────────────────────────────────────────────────
    await db.query(
      'UPDATE admins SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [admin.id],
    );

    return success({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name ?? 'no_name_available',
        username: admin.username ?? 'no_username',
        role: 'admin' as const,
        adminRole: admin.admin_role,
        permissions: admin.permissions ?? [],
        lastLoginAt: admin.last_login_at ?? null,
        createdAt: admin.created_at,
      },
    });
  } catch (error) {
    console.error('[/api/auth/admin/login] Error:', error);
    return badRequest('Login failed');
  }
}
