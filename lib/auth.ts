/**
 * lib/auth.ts — JWT authentication middleware for Next.js API routes
 *
 * Usage in a route handler:
 *   import { verifyAuth, requireRole } from '@/lib/auth';
 *
 *   export async function GET(req: NextRequest) {
 *     const user = verifyAuth(req);
 *     if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *     ...
 *   }
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { config } from './config';

const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN = config.jwtExpiresIn;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  id: string;
  email: string;
  fullName: string;
  role: 'tourist' | 'admin' | 'service';
  // Tourist / service fields
  did?: string;
  kycStatus?: 'pending' | 'verified' | 'rejected';
  kycVerified?: boolean;
  // Admin-specific fields (populated for tokens from /api/auth/admin/login)
  username?: string;
  adminRole?: 'admin' | 'super_admin';
  permissions?: string[];
}

export interface AuthUser extends JWTPayload {
  iat?: number;
  exp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign a JWT with the user's profile data.
 */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

// ─────────────────────────────────────────────────────────────────────────────
// Token extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract Bearer token from Authorization header.
 */
export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  // Support "Bearer <token>" and raw token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return authHeader.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Token verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify the JWT from the request and return the user payload.
 * Returns null if the token is missing or invalid.
 */
export function verifyAuth(req: NextRequest): AuthUser | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify auth and check the user's role.
 * Returns the user if authorized, null otherwise.
 */
export function requireRole(
  req: NextRequest,
  ...roles: string[]
): AuthUser | null {
  const user = verifyAuth(req);
  if (!user) return null;
  if (!roles.includes(user.role)) return null;
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response helpers
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function success<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
