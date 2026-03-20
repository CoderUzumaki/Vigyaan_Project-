/**
 * PUT    /api/zones/[id] — Update a zone (admin only, partial update)
 * DELETE /api/zones/[id] — Soft-delete a zone (admin only, sets active=false)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, forbidden, badRequest, success } from '@/lib/auth';

const VALID_SEVERITIES = ['green', 'amber', 'red'];

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/zones/[id] — partial update
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  const { id } = params;

  try {
    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return badRequest('name must be a non-empty string');
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name.trim());
    }

    if (body.severity !== undefined) {
      if (!VALID_SEVERITIES.includes(body.severity)) {
        return badRequest(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
      }
      updates.push(`severity = $${paramIndex++}`);
      values.push(body.severity);
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return badRequest('active must be a boolean');
      }
      updates.push(`active = $${paramIndex++}`);
      values.push(body.active);
    }

    if (updates.length === 0) {
      return badRequest('No valid fields to update (name, severity, active)');
    }

    values.push(id);
    const result = await db.query(
      `UPDATE geofence_zones SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
      values,
    );

    if (result.rows.length === 0) {
      return badRequest('Zone not found');
    }

    return success({ ok: true });
  } catch (error) {
    console.error('[/api/zones/[id] PUT] Error:', error);
    return badRequest('Failed to update zone');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/zones/[id] — soft delete (never hard delete)
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  const { id } = params;

  try {
    const result = await db.query(
      `UPDATE geofence_zones SET active = false WHERE id = $1 AND active = true RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return badRequest('Zone not found or already deactivated');
    }

    return success({ ok: true });
  } catch (error) {
    console.error('[/api/zones/[id] DELETE] Error:', error);
    return badRequest('Failed to delete zone');
  }
}
