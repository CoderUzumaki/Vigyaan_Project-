-- ─────────────────────────────────────────────────────────────────────────────
-- db/worker_errors.sql
-- Postgres schema additions for the Fabric BullMQ worker.
-- Run this after the main safetourism schema is already created.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Worker error log — stores jobs that exhausted all retry attempts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS worker_errors (
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

-- Index for querying unresolved errors
CREATE INDEX IF NOT EXISTS idx_worker_errors_unresolved
    ON worker_errors (resolved, failed_at DESC)
    WHERE resolved = FALSE;

-- Index for querying by job type
CREATE INDEX IF NOT EXISTS idx_worker_errors_job_type
    ON worker_errors (job_type, failed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Add fabric_tx_hash columns to existing tables
-- These store the Hyperledger Fabric transaction hash after the worker
-- successfully writes to the ledger.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tourist table
ALTER TABLE tourists
    ADD COLUMN IF NOT EXISTS fabric_tx_hash TEXT,
    ADD COLUMN IF NOT EXISTS fabric_pending BOOLEAN DEFAULT TRUE;

-- SOS events table
ALTER TABLE sos_events
    ADD COLUMN IF NOT EXISTS fabric_tx_hash TEXT,
    ADD COLUMN IF NOT EXISTS fabric_pending BOOLEAN DEFAULT TRUE;

-- Breach events table
ALTER TABLE breach_events
    ADD COLUMN IF NOT EXISTS fabric_tx_hash TEXT,
    ADD COLUMN IF NOT EXISTS fabric_pending BOOLEAN DEFAULT TRUE;

-- Dispatch events table
ALTER TABLE dispatch_events
    ADD COLUMN IF NOT EXISTS fabric_tx_hash TEXT,
    ADD COLUMN IF NOT EXISTS fabric_pending BOOLEAN DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: pending fabric transactions (for monitoring)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_fabric_pending AS
    SELECT 'sos_events' AS source_table, id, fabric_pending, fabric_tx_hash
    FROM sos_events WHERE fabric_pending = TRUE
UNION ALL
    SELECT 'breach_events', id, fabric_pending, fabric_tx_hash
    FROM breach_events WHERE fabric_pending = TRUE
UNION ALL
    SELECT 'dispatch_events', id, fabric_pending, fabric_tx_hash
    FROM dispatch_events WHERE fabric_pending = TRUE
UNION ALL
    SELECT 'tourists', id, fabric_pending, fabric_tx_hash
    FROM tourists WHERE fabric_pending = TRUE;

COMMENT ON VIEW v_fabric_pending IS
    'Shows all records waiting to be written to the Fabric ledger. Use to monitor worker lag.';
