/**
 * POST /api/services/consent
 *
 * Toggle insurance data-sharing consent for the authenticated tourist.
 * Queues a Fabric job to record consent change on the blockchain.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';
import { addFabricJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { granted } = body;

    if (typeof granted !== 'boolean') {
      return badRequest('granted must be a boolean (true or false)');
    }

    // Update consent in Postgres
    await db.query(
      'UPDATE tourists SET insurance_consent = $1, updated_at = NOW() WHERE id = $2',
      [granted, user.id],
    );

    // Queue Fabric job (stub-safe — works without Fabric)
    await addFabricJob('CONSENT_UPDATED', {
      touristId: user.id,
      did: user.did,
      consentGranted: granted,
      timestamp: new Date().toISOString(),
    });

    return success({
      ok: true,
      insuranceConsent: granted,
      message: granted
        ? 'Insurance data sharing enabled'
        : 'Insurance data sharing disabled',
    });
  } catch (error) {
    console.error('[/api/services/consent] Error:', error);
    return badRequest('Failed to update consent');
  }
}
