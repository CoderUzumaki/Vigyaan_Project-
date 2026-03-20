-- ═══════════════════════════════════════════════════════════════════════════
-- Tourist Safety System — Complete PostgreSQL Schema
-- Database: tourist_safety | User: postgres
-- Compatible with plain postgres:15 (no PostGIS required)
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- tourists — registered users (tourists, admins, service accounts)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tourists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  did             TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL DEFAULT 'tourist'
                    CHECK (role IN ('tourist','admin','service')),
  kyc_status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (kyc_status IN ('pending','verified','rejected')),
  kyc_verified    BOOLEAN NOT NULL DEFAULT false,
  insurance_consent BOOLEAN NOT NULL DEFAULT false,
  pin_hash        TEXT,
  push_token      TEXT,
  fabric_tx_hash  TEXT,
  fabric_pending  BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- tourist_locations — GPS pings from the mobile app (every 30s)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tourist_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tourist_id  UUID NOT NULL REFERENCES tourists(id) ON DELETE CASCADE,
  lat         DECIMAL(9,6) NOT NULL,
  lng         DECIMAL(9,6) NOT NULL,
  accuracy    DECIMAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tourist_locations_tourist_id ON tourist_locations(tourist_id);
CREATE INDEX idx_tourist_locations_recorded_at ON tourist_locations(recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- geofence_zones — safety zone polygons stored as GeoJSON in JSONB
-- boundary format: GeoJSON Polygon, e.g.
--   { "type": "Polygon", "coordinates": [[[lng,lat], ...]] }
-- Point-in-polygon checks use a server-side JS function or app-layer logic.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE geofence_zones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('green','amber','red')),
  boundary    JSONB NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES tourists(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_geofence_zones_boundary ON geofence_zones USING GIN (boundary);
CREATE INDEX idx_geofence_zones_active ON geofence_zones(active) WHERE active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- sos_events — SOS alerts from tourists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE sos_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tourist_id      UUID NOT NULL REFERENCES tourists(id),
  sos_type        TEXT NOT NULL CHECK (sos_type IN ('medical','fire','police')),
  intent_method   TEXT NOT NULL CHECK (intent_method IN ('countdown','pin','gyro_panic')),
  lat             DECIMAL(9,6),
  lng             DECIMAL(9,6),
  kyc_verified    BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL
                    CHECK (status IN ('confirmed','cancelled','duplicate_blocked','stale_rejected','invalid_pin')),
  outcome         TEXT CHECK (outcome IN ('responded','false_alarm','tourist_safe','pending')),
  fabric_tx_hash  TEXT,
  fabric_pending  BOOLEAN NOT NULL DEFAULT true,
  confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sos_events_tourist_id ON sos_events(tourist_id);
CREATE INDEX idx_sos_events_status ON sos_events(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- breach_events — geofence breach records
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE breach_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tourist_id      UUID NOT NULL REFERENCES tourists(id),
  lat             DECIMAL(9,6) NOT NULL,
  lng             DECIMAL(9,6) NOT NULL,
  zone_id         UUID REFERENCES geofence_zones(id),
  severity        TEXT NOT NULL CHECK (severity IN ('amber','red')),
  fabric_tx_hash  TEXT,
  fabric_pending  BOOLEAN NOT NULL DEFAULT true,
  breached_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX idx_breach_events_tourist_id ON breach_events(tourist_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- kyc_submissions — passport + selfie uploads for KYC verification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE kyc_submissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tourist_id        UUID NOT NULL REFERENCES tourists(id) UNIQUE,
  passport_path     TEXT,
  selfie_path       TEXT,
  face_match_score  DECIMAL(5,4),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  rejection_reason  TEXT,
  reviewed_by       UUID REFERENCES tourists(id),
  reviewed_at       TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- dispatch_events — responder dispatches to SOS incidents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE dispatch_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id     UUID NOT NULL REFERENCES sos_events(id),
  responder_id    TEXT NOT NULL,
  responder_type  TEXT NOT NULL CHECK (responder_type IN ('medical','fire','police')),
  responder_lat   DECIMAL(9,6),
  responder_lng   DECIMAL(9,6),
  status          TEXT NOT NULL DEFAULT 'en_route'
                    CHECK (status IN ('en_route','on_scene','complete')),
  eta_seconds     INTEGER,
  fabric_tx_hash  TEXT,
  fabric_pending  BOOLEAN NOT NULL DEFAULT true,
  dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- service_accounts — insurance companies, tourism boards, government
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE service_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_name      TEXT NOT NULL,
  org_type      TEXT NOT NULL CHECK (org_type IN ('insurance','tourism_board','government')),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  api_key       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- worker_errors — exhausted BullMQ job failures
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE worker_errors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          TEXT,
  job_type        TEXT NOT NULL,
  job_data        JSONB,
  error_message   TEXT,
  failed_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT
);
CREATE INDEX idx_worker_errors_unresolved ON worker_errors (resolved, failed_at DESC) WHERE resolved = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed Data
-- ═══════════════════════════════════════════════════════════════════════════

-- Seed users — passwords hashed with bcrypt (10 rounds)
-- admin@safetourism.gov / Admin@123
-- tourist1@test.com     / Tourist@123
-- tourist2@test.com     / Tourist@123
INSERT INTO tourists (email, password_hash, full_name, did, role, kyc_verified, kyc_status) VALUES
  ('admin@safetourism.gov',
   '$2b$10$1tCXNnWaY88b2RPCPOOFIeOW0iWtKupYc4X0IeWjM3rEZQW0I9LbK',
   'Admin User', 'did:fab:admin:001', 'admin', true, 'verified'),
  ('tourist1@test.com',
   '$2b$10$q0qsdoV0H0.KzDfzRMjGOeAvamPmHP0SEXox1wMpKiKrNHSgv1SG6',
   'Priya Sharma', 'did:fab:tourist:001', 'tourist', true, 'verified'),
  ('tourist2@test.com',
   '$2b$10$q0qsdoV0H0.KzDfzRMjGOeAvamPmHP0SEXox1wMpKiKrNHSgv1SG6',
   'Marco Lenz', 'did:fab:tourist:002', 'tourist', false, 'pending');

-- Geofence zones around Delhi (stored as GeoJSON in JSONB)
INSERT INTO geofence_zones (name, severity, boundary) VALUES
  ('Main visitor zone', 'green',
   '{"type":"Polygon","coordinates":[[[77.19,28.60],[77.23,28.60],[77.23,28.63],[77.19,28.63],[77.19,28.60]]]}'),
  ('Caution perimeter', 'amber',
   '{"type":"Polygon","coordinates":[[[77.18,28.59],[77.24,28.59],[77.24,28.64],[77.18,28.64],[77.18,28.59]]]}'),
  ('Restricted northern area', 'red',
   '{"type":"Polygon","coordinates":[[[77.20,28.64],[77.22,28.64],[77.22,28.66],[77.20,28.66],[77.20,28.64]]]}');

-- Service account — claims@safetravel.com / Service@123
INSERT INTO service_accounts (org_name, org_type, email, password_hash) VALUES
  ('SafeTravel Insurance Ltd', 'insurance', 'claims@safetravel.com',
   '$2b$10$loMUxXyuruRVt024y/x8p.UEQY.3KL/sppiKivRfz6ykJjjXBwZg2');

-- ═══════════════════════════════════════════════════════════════════════════
-- Monitoring Views
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_fabric_pending AS
  SELECT 'sos_events' AS source_table, id, fabric_pending, fabric_tx_hash FROM sos_events WHERE fabric_pending = TRUE
  UNION ALL
  SELECT 'breach_events', id, fabric_pending, fabric_tx_hash FROM breach_events WHERE fabric_pending = TRUE
  UNION ALL
  SELECT 'dispatch_events', id, fabric_pending, fabric_tx_hash FROM dispatch_events WHERE fabric_pending = TRUE
  UNION ALL
  SELECT 'tourists', id, fabric_pending, fabric_tx_hash FROM tourists WHERE fabric_pending = TRUE;
