/**
 * POST /api/tourist/set-pin
 *
 * Set or update the tourist's 4-digit SOS confirmation PIN.
 * Requires: tourist auth
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { pin } = body;

    // ── Validate PIN format ───────────────────────────────────────────────
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return badRequest('PIN must be exactly 4 digits');
    }

    // ── Hash and store ────────────────────────────────────────────────────
    const pinHash = await bcrypt.hash(pin, 10);

    await db.query(
      'UPDATE tourists SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
      [pinHash, user.id],
    );

    return success({ ok: true, message: 'PIN set successfully' });
  } catch (error) {
    console.error('[/api/tourist/set-pin] Error:', error);
    return badRequest('Failed to set PIN');
  }
}
