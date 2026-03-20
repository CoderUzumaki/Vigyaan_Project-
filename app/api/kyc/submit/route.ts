/**
 * POST /api/kyc/submit
 *
 * Submit KYC documents (passport photo + selfie).
 * Saves files locally in dev, uses INSERT ... ON CONFLICT for resubmissions.
 */

import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const formData = await req.formData();
    const passportPhoto = formData.get('passportPhoto') as File | null;
    const selfie = formData.get('selfie') as File | null;

    if (!passportPhoto && !selfie) {
      return badRequest('At least one file (passportPhoto or selfie) is required');
    }

    // Save files to configured upload dir
    const dir = path.join(config.kycUploadDir, user.id);
    await mkdir(dir, { recursive: true });

    let passportPath: string | null = null;
    let selfiePath: string | null = null;

    if (passportPhoto) {
      passportPath = path.join(dir, 'passport.jpg');
      const buffer = Buffer.from(await passportPhoto.arrayBuffer());
      await writeFile(passportPath, buffer);
    }

    if (selfie) {
      selfiePath = path.join(dir, 'selfie.jpg');
      const buffer = Buffer.from(await selfie.arrayBuffer());
      await writeFile(selfiePath, buffer);
    }

    // Upsert KYC submission
    const result = await db.query(
      `INSERT INTO kyc_submissions (tourist_id, passport_path, selfie_path, status, submitted_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       ON CONFLICT (tourist_id) DO UPDATE SET
         passport_path = COALESCE($2, kyc_submissions.passport_path),
         selfie_path = COALESCE($3, kyc_submissions.selfie_path),
         status = 'pending',
         submitted_at = NOW()
       RETURNING id`,
      [user.id, passportPath, selfiePath],
    );

    return success({ ok: true, submissionId: result.rows[0].id }, 201);
  } catch (error) {
    console.error('[/api/kyc/submit] Error:', error);
    return badRequest('KYC submission failed');
  }
}
