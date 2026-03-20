/**
 * lib/geofence.ts — Geofence breach detection engine
 *
 * Geofence zones are stored as GeoJSON polygons in JSONB columns.
 * Point-in-polygon check is done in JavaScript using ray-casting algorithm.
 * This avoids requiring PostGIS while keeping full geofence functionality.
 */

import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BreachResult {
  zoneId: string;
  zoneName: string;
  severity: 'amber' | 'red';
  distanceMeters: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: { id: string; name: string; severity: string };
  geometry: { type: string; coordinates: number[][][] };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface ZoneRow {
  id: string;
  name: string;
  severity: string;
  boundary: { type: string; coordinates: number[][][] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ray-casting algorithm — point-in-polygon check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a point (lng, lat) is inside a GeoJSON Polygon.
 * Uses the ray-casting (even-odd) algorithm.
 */
function pointInPolygon(lng: number, lat: number, polygon: number[][][]): boolean {
  // GeoJSON polygons: first ring is exterior, rest are holes
  const ring = polygon[0];
  if (!ring || ring.length < 4) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Approximate distance in meters between a point and a polygon boundary.
 * Uses Haversine formula to the nearest vertex (fast approximation).
 */
function distanceToPolygon(lng: number, lat: number, polygon: number[][][]): number {
  const ring = polygon[0];
  if (!ring || ring.length === 0) return Infinity;

  let minDist = Infinity;
  for (const [pLng, pLat] of ring) {
    const dist = haversineMeters(lat, lng, pLat, pLng);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

/**
 * Haversine distance between two points in meters.
 */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main geofence check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if tourist is in breach of any geofence zone.
 *
 * Returns null if the tourist is INSIDE any active zone (no breach).
 * Returns BreachResult if OUTSIDE all zones (with nearest zone info).
 */
export async function checkGeofenceBreach(
  touristId: string,
  lat: number,
  lng: number,
): Promise<BreachResult | null> {
  // Fetch all active zones
  const result = await db.query(
    `SELECT id, name, severity, boundary
     FROM geofence_zones
     WHERE active = true`,
  );

  const zones: ZoneRow[] = result.rows;
  if (zones.length === 0) return null; // No zones defined — no breach possible

  // Step 1: Is tourist INSIDE any active zone?
  for (const zone of zones) {
    const boundary = typeof zone.boundary === 'string'
      ? JSON.parse(zone.boundary)
      : zone.boundary;

    if (boundary?.coordinates && pointInPolygon(lng, lat, boundary.coordinates)) {
      return null; // Inside a zone — no breach
    }
  }

  // Step 2: Outside all zones — find nearest zone for context
  let nearest: { zone: ZoneRow; distance: number } | null = null;

  for (const zone of zones) {
    const boundary = typeof zone.boundary === 'string'
      ? JSON.parse(zone.boundary)
      : zone.boundary;

    if (!boundary?.coordinates) continue;

    const dist = distanceToPolygon(lng, lat, boundary.coordinates);
    if (!nearest || dist < nearest.distance) {
      nearest = { zone, distance: dist };
    }
  }

  return {
    zoneId: nearest?.zone.id ?? 'unknown_zone',
    zoneName: nearest?.zone.name ?? 'Unknown Zone',
    severity: (nearest?.distance ?? 999) < 50 ? 'amber' : 'red',
    distanceMeters: Math.round(nearest?.distance ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoJSON export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all active zones as a GeoJSON FeatureCollection.
 */
export async function getZonesAsGeoJSON(): Promise<GeoJSONFeatureCollection> {
  const result = await db.query(
    `SELECT id, name, severity, boundary
     FROM geofence_zones
     WHERE active = true`,
  );

  return {
    type: 'FeatureCollection',
    features: result.rows.map((row) => ({
      type: 'Feature' as const,
      properties: { id: row.id, name: row.name, severity: row.severity },
      geometry: typeof row.boundary === 'string'
        ? JSON.parse(row.boundary)
        : row.boundary,
    })),
  };
}
