/**
 * GET /api/sos/eta?incidentId=<uuid>
 *
 * Calculate ETA for nearest service based on SOS type.
 * Finds the nearest service_location matching the sos_type,
 * calculates distance using Haversine, and returns ETA
 * assuming an average response speed of 40 km/h in urban Raipur.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, unauthorized, badRequest, success } from '@/lib/auth';

const AVERAGE_SPEED_KMH = 40; // Average emergency vehicle speed in urban Raipur

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(req: NextRequest) {
  const user = verifyAuth(req);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const incidentId = searchParams.get('incidentId');

    if (!incidentId) {
      return badRequest('incidentId query parameter is required');
    }

    // Get the SOS event details
    const sosResult = await db.query(
      `SELECT sos_type, lat, lng, status FROM sos_events WHERE id = $1 AND tourist_id = $2`,
      [incidentId, user.id],
    );

    if (sosResult.rows.length === 0) {
      return badRequest('Incident not found');
    }

    const sos = sosResult.rows[0];

    // If the incident has no GPS coordinates, use the tourist's last known location
    let incidentLat = sos.lat ? parseFloat(sos.lat) : null;
    let incidentLng = sos.lng ? parseFloat(sos.lng) : null;

    if (incidentLat === null || incidentLng === null) {
      const locResult = await db.query(
        `SELECT lat, lng FROM tourist_locations WHERE tourist_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
        [user.id],
      );
      if (locResult.rows.length > 0) {
        incidentLat = parseFloat(locResult.rows[0].lat);
        incidentLng = parseFloat(locResult.rows[0].lng);
      }
    }

    if (incidentLat === null || incidentLng === null) {
      return success({
        etaSeconds: null,
        nearestService: null,
        message: 'No location data available to calculate ETA',
      });
    }

    // Find nearest service of matching type
    const serviceResult = await db.query(
      `SELECT id, name, service_type, lat, lng FROM service_locations
       WHERE service_type = $1 AND active = true`,
      [sos.sos_type],
    );

    if (serviceResult.rows.length === 0) {
      return success({
        etaSeconds: null,
        nearestService: null,
        message: `No ${sos.sos_type} service locations available`,
      });
    }

    // Find the nearest one using Haversine
    let nearestService: { id: string; name: string; distance: number; lat: number; lng: number } | null = null;

    for (const svc of serviceResult.rows) {
      const svcLat = parseFloat(svc.lat);
      const svcLng = parseFloat(svc.lng);
      const dist = haversineMeters(incidentLat, incidentLng, svcLat, svcLng);

      if (!nearestService || dist < nearestService.distance) {
        nearestService = {
          id: svc.id,
          name: svc.name,
          distance: dist,
          lat: svcLat,
          lng: svcLng,
        };
      }
    }

    if (!nearestService) {
      return success({ etaSeconds: null, nearestService: null });
    }

    // Calculate ETA: distance (m) → km, then time = distance / speed
    const distanceKm = nearestService.distance / 1000;
    const etaHours = distanceKm / AVERAGE_SPEED_KMH;
    const etaSeconds = Math.round(etaHours * 3600);

    // Minimum 60 seconds for very close services (preparation time)
    const finalEta = Math.max(60, etaSeconds);

    return success({
      etaSeconds: finalEta,
      distanceMeters: Math.round(nearestService.distance),
      nearestService: {
        id: nearestService.id,
        name: nearestService.name,
        serviceType: sos.sos_type,
        lat: nearestService.lat,
        lng: nearestService.lng,
      },
      incidentStatus: sos.status,
    });
  } catch (error) {
    console.error('[/api/sos/eta] Error:', error);
    return badRequest('Failed to calculate ETA');
  }
}
