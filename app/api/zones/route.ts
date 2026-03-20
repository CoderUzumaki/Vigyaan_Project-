/**
 * GET  /api/zones — Get all active zones as GeoJSON (any auth user)
 * POST /api/zones — Create a new zone (admin only)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireRole, unauthorized, forbidden, badRequest, success } from '@/lib/auth';
import { getZonesAsGeoJSON } from '@/lib/geofence';

const VALID_SEVERITIES = ['green', 'amber', 'red'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/zones — public (auth required)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const geojson = await getZonesAsGeoJSON();
    return success(geojson);
  } catch (error) {
    console.error('[/api/zones GET] Error:', error);
    return badRequest('Failed to fetch zones');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/zones — admin only
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = requireRole(req, 'admin');
  if (!admin) return forbidden('Admin access required');

  try {
    const body = await req.json();
    const { name, severity, boundary } = body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return badRequest('Zone name is required');
    }
    if (!severity || !VALID_SEVERITIES.includes(severity)) {
      return badRequest(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
    }
    if (!boundary || typeof boundary !== 'object') {
      return badRequest('boundary must be a GeoJSON Polygon object');
    }
    if (boundary.type !== 'Polygon' || !Array.isArray(boundary.coordinates)) {
      return badRequest('boundary must be a valid GeoJSON Polygon with coordinates array');
    }

    // Validate polygon is closed (first point == last point)
    const ring = boundary.coordinates[0];
    if (!ring || ring.length < 4) {
      return badRequest('Polygon must have at least 4 coordinate pairs (first = last)');
    }

    // ── Insert ────────────────────────────────────────────────────────────
    const result = await db.query(
      `INSERT INTO geofence_zones (name, severity, boundary, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name.trim(), severity, JSON.stringify(boundary), admin.id],
    );

    return success({ ok: true, zoneId: result.rows[0].id }, 201);
  } catch (error) {
    console.error('[/api/zones POST] Error:', error);
    return badRequest('Failed to create zone');
  }
}
