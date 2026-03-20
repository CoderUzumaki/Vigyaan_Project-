/**
 * POST /api/sos/confirm
 *
 * Confirm an SOS alert. Implements:
 * - Redis-based duplicate lock (60s)
 * - Timestamp freshness check (30s max age)
 * - PIN verification for covert 'pin' intent method
 * - Server-side GPS (never trust client GPS for incident record)
 * - Real-time Redis pub/sub alert
 * - Fabric queue job
 */

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';
import { safeLock, safeUnlock, safePublish } from '@/lib/redis';
import { addFabricJob } from '@/lib/queue';
import { NextResponse } from 'next/server';

const VALID_SOS_TYPES = ['medical', 'fire', 'police'];
const VALID_INTENT_METHODS = ['countdown', 'pin', 'gyro_panic'];

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { sosType, intentMethod, clientTimestamp, pin } = body;

    // ── Validate inputs ───────────────────────────────────────────────────
    if (!sosType || !VALID_SOS_TYPES.includes(sosType)) {
      return badRequest(`sosType must be one of: ${VALID_SOS_TYPES.join(', ')}`);
    }
    if (!intentMethod || !VALID_INTENT_METHODS.includes(intentMethod)) {
      return badRequest(`intentMethod must be one of: ${VALID_INTENT_METHODS.join(', ')}`);
    }
    if (!clientTimestamp) {
      return badRequest('clientTimestamp is required');
    }

    // ── Duplicate lock (60s cooldown) ─────────────────────────────────────
    const lockKey = `sos:lock:${user.id}`;
    const locked = await safeLock(lockKey, 60);
    if (!locked) {
      return NextResponse.json(
        { error: 'SOS already active — try again in 60 seconds' },
        { status: 429 },
      );
    }

    // ── Timestamp freshness (max 30s old) ─────────────────────────────────
    const age = Date.now() - new Date(clientTimestamp).getTime();
    if (isNaN(age) || age > 30000) {
      await safeUnlock(lockKey);
      return badRequest('SOS request is stale (>30s old). Please try again.');
    }

    // ── PIN verification (for covert 'pin' method) ────────────────────────
    if (intentMethod === 'pin') {
      const touristFull = await db.query(
        'SELECT pin_hash FROM tourists WHERE id = $1',
        [user.id],
      );
      const pinHash = touristFull.rows[0]?.pin_hash;

      if (!pinHash) {
        await safeUnlock(lockKey);
        return badRequest('No PIN set. Please set a PIN first via /api/tourist/set-pin.');
      }
      if (!pin || typeof pin !== 'string') {
        await safeUnlock(lockKey);
        return badRequest('PIN is required for pin-based SOS.');
      }

      const pinValid = await bcrypt.compare(pin, pinHash);
      if (!pinValid) {
        await safeUnlock(lockKey);
        return badRequest('Invalid PIN.');
      }
    }

    // ── Server-side GPS (NEVER trust client GPS for incident record) ──────
    const lastLoc = await db.query(
      'SELECT lat, lng FROM tourist_locations WHERE tourist_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [user.id],
    );
    const lat = lastLoc.rows[0]?.lat ?? null;
    const lng = lastLoc.rows[0]?.lng ?? null;

    // ── Get tourist details for alert ─────────────────────────────────────
    const touristData = await db.query(
      'SELECT full_name, kyc_verified FROM tourists WHERE id = $1',
      [user.id],
    );
    const displayName = touristData.rows[0]?.full_name ?? 'no_name_available';
    const kycVerified = touristData.rows[0]?.kyc_verified ?? false;

    // ── Insert SOS event ──────────────────────────────────────────────────
    const result = await db.query(
      `INSERT INTO sos_events
         (tourist_id, sos_type, intent_method, lat, lng, kyc_verified, status, outcome, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', 'pending', NOW())
       RETURNING id`,
      [user.id, sosType, intentMethod, lat, lng, kycVerified],
    );
    const incidentId = result.rows[0].id;

    // ── Publish real-time alert ───────────────────────────────────────────
    await safePublish('sos:alert', {
      incidentId,
      touristId: user.id,
      displayName,
      lat,
      lng,
      sosType,
      kycVerified,
      intentMethod,
      timestamp: new Date().toISOString(),
      fabricPending: true,
    });

    // ── Queue blockchain job ──────────────────────────────────────────────
    await addFabricJob('SOS_CONFIRMED', {
      incidentId,
      touristId: user.id,
      sosType,
      intentMethod,
      lat,
      lng,
      kycVerified,
    });

    return success({ ok: true, incidentId });
  } catch (error) {
    console.error('[/api/sos/confirm] Error:', error);
    return badRequest('SOS confirmation failed');
  }
}
