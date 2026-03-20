#!/bin/bash
###############################################################################
# scripts/runWorker.sh — Start the Fabric BullMQ worker
#
# Runs alongside the Next.js dev server as a separate process.
# Requires: Redis, PostgreSQL, and the Fabric network running.
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Resolve fabric-samples path ─────────────────────────────────────────────
if [ -z "${FABRIC_SAMPLES_PATH:-}" ]; then
  if [ -d "${PROJECT_DIR}/../fabric-samples" ]; then
    export FABRIC_SAMPLES_PATH="$(cd "${PROJECT_DIR}/../fabric-samples" && pwd)"
  elif [ -d "/tmp/fabric-samples" ]; then
    export FABRIC_SAMPLES_PATH="/tmp/fabric-samples"
  else
    echo "ERROR: FABRIC_SAMPLES_PATH not set and fabric-samples not found."
    echo "  Set FABRIC_SAMPLES_PATH or place fabric-samples in parent directory."
    exit 1
  fi
fi

# ── Default environment variables ────────────────────────────────────────────
export DATABASE_URL="${DATABASE_URL:-postgresql://admin:devpassword@localhost:5432/safetourism}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-3}"
export FABRIC_CHANNEL="${FABRIC_CHANNEL:-safetychannel}"
export FABRIC_CHAINCODE="${FABRIC_CHAINCODE:-safetychaincode}"

echo "============================================================"
echo "  Fabric Event Worker"
echo "============================================================"
echo "  FABRIC_SAMPLES_PATH: ${FABRIC_SAMPLES_PATH}"
echo "  DATABASE_URL:        ${DATABASE_URL//:*@//:***@}"
echo "  REDIS_URL:           ${REDIS_URL//:*@//:***@}"
echo "  WORKER_CONCURRENCY:  ${WORKER_CONCURRENCY}"
echo "  FABRIC_CHANNEL:      ${FABRIC_CHANNEL}"
echo "  FABRIC_CHAINCODE:    ${FABRIC_CHAINCODE}"
echo "============================================================"
echo ""

# ── Start the worker ─────────────────────────────────────────────────────────
cd "${PROJECT_DIR}"

# Use tsx if available (faster), fall back to ts-node
if command -v npx &>/dev/null; then
  echo "[runWorker] Starting worker with npx tsx..."
  exec npx tsx workers/startWorker.ts
else
  echo "ERROR: npx not found. Install Node.js first."
  exit 1
fi
