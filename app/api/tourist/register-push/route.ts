/**
 * POST /api/tourist/register-push
 *
 * Register or update the tourist's push notification token.
 * Called by the React Native app after obtaining a push token.
 * Requires: tourist auth
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { pushToken } = body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!pushToken || typeof pushToken !== 'string' || pushToken.trim().length === 0) {
      return badRequest('pushToken is required');
    }

    // ── Store token ───────────────────────────────────────────────────────
    await db.query(
      'UPDATE tourists SET push_token = $1, updated_at = NOW() WHERE id = $2',
      [pushToken.trim(), user.id],
    );

    return success({ ok: true, message: 'Push token registered' });
  } catch (error) {
    console.error('[/api/tourist/register-push] Error:', error);
    return badRequest('Failed to register push token');
  }
}
