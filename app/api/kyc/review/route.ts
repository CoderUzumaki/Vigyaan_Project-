/**
 * POST /api/kyc/review — Admin reviews a KYC submission
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';
import { addFabricJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  try {
    const body = await req.json();
    const { submissionId, decision, rejectionReason } = body;

    if (!submissionId || typeof submissionId !== 'string') {
      return badRequest('submissionId is required');
    }
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return badRequest('decision must be "approved" or "rejected"');
    }
    if (decision === 'rejected' && (!rejectionReason || rejectionReason.trim().length === 0)) {
      return badRequest('rejectionReason is required when rejecting');
    }

    // Get submission to find tourist_id
    const submission = await db.query(
      'SELECT tourist_id FROM kyc_submissions WHERE id = $1',
      [submissionId],
    );
    if (submission.rows.length === 0) {
      return badRequest('Submission not found');
    }
    const touristId = submission.rows[0].tourist_id;

    // Update submission
    await db.query(
      `UPDATE kyc_submissions
       SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [decision, decision === 'rejected' ? rejectionReason.trim() : null, admin.id, submissionId],
    );

    if (decision === 'approved') {
      await db.query(
        `UPDATE tourists SET kyc_verified = true, kyc_status = 'verified', updated_at = NOW()
         WHERE id = $1`,
        [touristId],
      );
      const kycHash = crypto.createHash('sha256').update(submissionId).digest('hex');
      await addFabricJob('KYC_VERIFIED', {
        touristId,
        submissionId,
        kycHash,
        reviewedBy: admin.id,
      });
    } else {
      await db.query(
        `UPDATE tourists SET kyc_status = 'rejected', updated_at = NOW()
         WHERE id = $1`,
        [touristId],
      );
    }

    return success({ ok: true, decision });
  } catch (error) {
    console.error('[/api/kyc/review] Error:', error);
    return badRequest('KYC review failed');
  }
}
