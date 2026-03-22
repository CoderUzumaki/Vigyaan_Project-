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
-- admins — dedicated admin accounts (separate from tourist/service users)
-- Permissions are stored as a JSONB array of capability strings.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT 'no_name_available',
  username      TEXT NOT NULL UNIQUE,
  admin_role    TEXT NOT NULL DEFAULT 'admin'
                  CHECK (admin_role IN ('admin', 'super_admin')),
  permissions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  active        BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_active ON admins(active) WHERE active = true;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- service_locations — nearby emergency services for ETA calculation
-- service_type maps to sos_type: police → police, medical → hospital, fire → fire station
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE service_locations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  service_type  TEXT NOT NULL CHECK (service_type IN ('police','medical','fire')),
  lat           DECIMAL(9,6) NOT NULL,
  lng           DECIMAL(9,6) NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_service_locations_type ON service_locations(service_type) WHERE active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed Data
-- ═══════════════════════════════════════════════════════════════════════════

-- Seed users — passwords hashed with bcrypt (10 rounds)
-- tourist1@test.com / Tourist@123
-- tourist2@test.com / Tourist@123
INSERT INTO tourists (email, password_hash, full_name, did, role, kyc_verified, kyc_status) VALUES
  ('tourist1@test.com',
   '$2b$10$q0qsdoV0H0.KzDfzRMjGOeAvamPmHP0SEXox1wMpKiKrNHSgv1SG6',
   'Priya Sharma', 'did:fab:tourist:001', 'tourist', true, 'verified'),
  ('tourist2@test.com',
   '$2b$10$q0qsdoV0H0.KzDfzRMjGOeAvamPmHP0SEXox1wMpKiKrNHSgv1SG6',
   'Marco Lenz', 'did:fab:tourist:002', 'tourist', false, 'pending');

-- Seed admins — passwords hashed with bcrypt (10 rounds)
-- admin@safetourism.gov / Admin@123  (super_admin — full access)
-- ops@safetourism.gov   / Admin@123  (admin — operational access only)
INSERT INTO admins (email, password_hash, full_name, username, admin_role, permissions) VALUES
  ('admin@safetourism.gov',
   '$2b$10$1tCXNnWaY88b2RPCPOOFIeOW0iWtKupYc4X0IeWjM3rEZQW0I9LbK',
   'System Administrator', 'sysadmin', 'super_admin',
   '["manage_tourists","review_kyc","dispatch_responders","manage_zones","view_analytics","manage_admins","resolve_incidents"]'::jsonb),
  ('ops@safetourism.gov',
   '$2b$10$1tCXNnWaY88b2RPCPOOFIeOW0iWtKupYc4X0IeWjM3rEZQW0I9LbK',
   'Operations Manager', 'opsmanager', 'admin',
   '["dispatch_responders","view_analytics","review_kyc","resolve_incidents"]'::jsonb);

-- Geofence zones around NIT Raipur / Gudhiyari, Raipur, Chhattisgarh
INSERT INTO geofence_zones (name, severity, boundary) VALUES
  ('NIT Raipur Campus Zone', 'green',
   '{"type":"Polygon","coordinates":[[[81.5990,21.2450],[81.6120,21.2450],[81.6120,21.2540],[81.5990,21.2540],[81.5990,21.2450]]]}'),
  ('Gudhiyari Caution Zone', 'amber',
   '{"type":"Polygon","coordinates":[[[81.5900,21.2380],[81.6200,21.2380],[81.6200,21.2600],[81.5900,21.2600],[81.5900,21.2380]]]}'),
  ('Ring Road Restricted Area', 'red',
   '{"type":"Polygon","coordinates":[[[81.5850,21.2600],[81.6100,21.2600],[81.6100,21.2750],[81.5850,21.2750],[81.5850,21.2600]]]}');

-- ── Service Locations — Police Stations near NIT Raipur / Gudhiyari ──────────
INSERT INTO service_locations (name, service_type, lat, lng) VALUES
  ('Gudhiyari Police Thana',                'police', 21.2470, 81.6020),
  ('Ram Nagar Police Chowki',               'police', 21.2500, 81.6000),
  ('Khamtarai Police Station',              'police', 21.2420, 81.6100),
  ('Telibandha Police Station',             'police', 21.2350, 81.6300),
  ('Pandri Police Station',                 'police', 21.2300, 81.6200),
  ('Fafadih Police Station',                'police', 21.2250, 81.6350),
  ('Civil Lines Police Station',            'police', 21.2400, 81.6350),
  ('Gole Bazaar Police Station',            'police', 21.2370, 81.6450),
  ('New Rajendra Nagar Police Station',     'police', 21.2550, 81.5950),
  ('Tatibandh Police Chowki',               'police', 21.2600, 81.5900);

-- ── Service Locations — Hospitals near NIT Raipur / Gudhiyari ────────────────
INSERT INTO service_locations (name, service_type, lat, lng) VALUES
  ('AIIMS Raipur',                          'medical', 21.2460, 81.6050),
  ('Suyash Hospital (Gudhiyari Rd)',        'medical', 21.2495, 81.6015),
  ('Pt. JN Memorial Medical College',       'medical', 21.2380, 81.6180),
  ('Shree Narayana Hospital',               'medical', 21.2430, 81.6120),
  ('Gayatri Hospital Gudhiyari',            'medical', 21.2510, 81.5980),
  ('Vivekanand Eye Hospital',               'medical', 21.2480, 81.6035),
  ('MedLife Super Speciality Hospital',     'medical', 21.2350, 81.6250),
  ('MMI Hospital Raipur',                   'medical', 21.2520, 81.6350);

-- ── Service Locations — Fire Stations near NIT Raipur / Gudhiyari ────────────
INSERT INTO service_locations (name, service_type, lat, lng) VALUES
  ('Tikrapara Fire Station',                'fire', 21.2200, 81.6420),
  ('Shakti Fire Service Gudhiyari',         'fire', 21.2485, 81.6010),
  ('Raipur Central Fire Station',           'fire', 21.2350, 81.6350),
  ('Tatibandh Fire Sub-Station',            'fire', 21.2620, 81.5870),
  ('Mowa Fire Station',                     'fire', 21.2680, 81.6100);

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
