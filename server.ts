/**
 * server.ts — Custom Next.js server with Socket.IO
 *
 * Provides real-time WebSocket connections for:
 * - Admin dashboard: SOS alerts, geofence breaches, responder updates
 * - Tourist app: SOS confirmations, blockchain write-back notifications
 *
 * Usage: npx tsx server.ts
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { addFabricJob } from './lib/queue';
import { config } from './lib/config';

const dev = config.isDev;
const app = next({ dev });
const handle = app.getRequestHandler();

const JWT_SECRET = config.jwtSecret;
const REDIS_URL = config.redisUrl;
const PORT = config.port;

// ── DB pool (separate from Next.js pool) ────────────────────────────────────
const db = new Pool({ connectionString: config.databaseUrl, max: 10 });

interface JWTPayload {
  id: string;
  email: string;
  fullName: string;
  did: string;
  role: string;
}

function verifyJWT(token: string | undefined): JWTPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl);
  });

  // ── Socket.IO ───────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── Redis adapter for horizontal scaling ────────────────────────────────
  try {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.IO] Redis adapter connected');
  } catch (err) {
    console.warn('[Socket.IO] Redis adapter failed — running without pub/sub scaling:', (err as Error).message);
  }

  // ── Connection handler ──────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const user = verifyJWT(token);

    if (!user) {
      socket.emit('auth_error', { message: 'Invalid or missing token' });
      socket.disconnect();
      return;
    }

    console.log(`[Socket.IO] ${user.role} connected: ${user.email}`);

    // ── Admin room ──────────────────────────────────────────────────────
    if (user.role === 'admin') {
      socket.join('admin');

      // Send current state snapshot on connect
      try {
        const [activeBreaches, activeSOS] = await Promise.all([
          db.query(
            `SELECT be.id, be.lat, be.lng, be.severity, be.breached_at,
                    t.full_name, t.id AS tourist_id,
                    gz.name AS zone_name
             FROM breach_events be
             JOIN tourists t ON t.id = be.tourist_id
             LEFT JOIN geofence_zones gz ON gz.id = be.zone_id
             WHERE be.resolved_at IS NULL
             AND be.breached_at > NOW() - INTERVAL '2 hours'`,
          ),
          db.query(
            `SELECT se.id, se.sos_type, se.intent_method, se.lat, se.lng,
                    se.status, se.outcome, se.confirmed_at,
                    t.full_name, t.id AS tourist_id, t.kyc_verified
             FROM sos_events se
             JOIN tourists t ON t.id = se.tourist_id
             WHERE se.status = 'confirmed' AND se.closed_at IS NULL`,
          ),
        ]);
        socket.emit('state_snapshot', {
          activeBreaches: activeBreaches.rows,
          activeSOS: activeSOS.rows,
        });
      } catch (err) {
        console.error('[Socket.IO] State snapshot error:', err);
      }

      // Admin dispatches a responder
      socket.on('dispatch_responder', async ({ incidentId, responderId, responderType }) => {
        try {
          const dispatch = await db.query(
            `INSERT INTO dispatch_events (incident_id, responder_id, responder_type, dispatched_at)
             VALUES ($1, $2, $3, NOW()) RETURNING id`,
            [incidentId, responderId, responderType],
          );
          await addFabricJob('DISPATCH_SENT', {
            dispatchId: dispatch.rows[0].id,
            incidentId,
            responderId,
            responderType,
          });
          io.to('admin').emit('responder_update', {
            dispatchId: dispatch.rows[0].id,
            responderId,
            incidentId,
            responderType,
            status: 'en_route',
            etaSeconds: 300,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('[Socket.IO] Dispatch error:', err);
          socket.emit('error', { message: 'Failed to dispatch responder' });
        }
      });

      // Admin resolves an incident
      socket.on('resolve_incident', async ({ incidentId, outcome }) => {
        try {
          await db.query(
            `UPDATE sos_events SET outcome = $1, closed_at = NOW(), status = 'confirmed'
             WHERE id = $2`,
            [outcome, incidentId],
          );
          await addFabricJob('INCIDENT_CLOSED', {
            incidentId,
            outcome,
            closedBy: user.id,
          });
          io.to('admin').emit('incident_resolved', {
            id: incidentId,
            outcome,
            resolvedBy: user.email,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('[Socket.IO] Resolve error:', err);
          socket.emit('error', { message: 'Failed to resolve incident' });
        }
      });
    }

    // ── Tourist room ────────────────────────────────────────────────────
    if (user.role === 'tourist') {
      socket.join(`tourist:${user.id}`);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] ${user.role} disconnected: ${user.email}`);
    });
  });

  // ── Subscribe to Redis channels → broadcast to socket rooms ─────────────
  try {
    const subscriber = createClient({ url: REDIS_URL });
    await subscriber.connect();

    await subscriber.subscribe('geofence:breach', (msg) => {
      try {
        io.to('admin').emit('geofence_breach', JSON.parse(msg));
      } catch { /* ignore parse errors */ }
    });

    await subscriber.subscribe('sos:alert', (msg) => {
      try {
        const data = JSON.parse(msg);
        io.to('admin').emit('sos_alert', data);
      } catch { /* ignore */ }
    });

    await subscriber.subscribe('beacon:missed', (msg) => {
      try {
        io.to('admin').emit('beacon_missed', JSON.parse(msg));
      } catch { /* ignore */ }
    });

    await subscriber.subscribe('zone:updated', (msg) => {
      try {
        io.to('admin').emit('zone_updated', JSON.parse(msg));
      } catch { /* ignore */ }
    });

    await subscriber.subscribe('sos:confirmed', (msg) => {
      try {
        const data = JSON.parse(msg);
        io.to(`tourist:${data.touristId}`).emit('sos_confirmed', data);
        io.to(`tourist:${data.touristId}`).emit('sos_chain_written', data);
      } catch { /* ignore */ }
    });

    console.log('[Socket.IO] Redis subscriber connected — listening on 4 channels');
  } catch (err) {
    console.warn('[Socket.IO] Redis subscriber failed:', (err as Error).message);
  }

  // ── Start server ────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`\n[Server] Tourist Safety System running on http://localhost:${PORT}`);
    console.log(`[Server] Socket.IO ready for connections`);
    console.log(`[Server] Mode: ${dev ? 'development' : 'production'}\n`);
  });
});
