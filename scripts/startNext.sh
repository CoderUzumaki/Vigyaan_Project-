#!/bin/bash
###############################################################################
# startNext.sh — Start the Next.js development server
#
# Starts the Next.js dev server with hot-reload for frontend development.
# This does NOT include Socket.IO (use backend.sh for the full server).
#
# Prerequisites:
#   - PostgreSQL and Redis must already be running
#   - Run ./scripts/backend.sh --db-only first, OR
#   - Run ./scripts/hyperledger.sh first (provides Redis)
#
# Usage:
#   ./scripts/startNext.sh            # start Next.js dev server (port 3000)
#   ./scripts/startNext.sh --prod     # start Next.js in production mode
#   ./scripts/startNext.sh --port 3001  # start on a custom port
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Parse arguments ──────────────────────────────────────────────────────────
MODE="dev"
PORT=3000
SKIP_CHECKS=false

i=1
while [ "${i}" -le "$#" ]; do
  arg="${!i}"
  case "${arg}" in
    --prod)         MODE="prod" ;;
    --skip-checks)  SKIP_CHECKS=true ;;
    --port)
      i=$((i + 1))
      PORT="${!i}" ;;
    --help|-h)
      echo "Usage: ./scripts/startNext.sh [--prod] [--port <port>] [--skip-checks]"
      echo ""
      echo "Options:"
      echo "  --prod           Start in production mode (next start) instead of dev"
      echo "  --port <port>    Port to listen on (default: 3000)"
      echo "  --skip-checks    Skip dependency checks"
      echo "  --help, -h       Show this help message"
      exit 0 ;;
  esac
  i=$((i + 1))
done

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Starting Next.js (mode: ${MODE}, port: ${PORT})${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

cd "${PROJECT_DIR}"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if [ "${SKIP_CHECKS}" = false ]; then
  echo "[1/3] Pre-flight checks..."

  # Check node_modules
  if [ ! -d "${PROJECT_DIR}/node_modules" ]; then
    warn "node_modules not found — running npm install..."
    npm install
  fi
  ok "node_modules present"

  # Check .env.local
  if [ -f "${PROJECT_DIR}/.env.local" ]; then
    set -a
    # shellcheck disable=SC1090
    source "${PROJECT_DIR}/.env.local"
    set +a
    ok "Loaded .env.local"
  elif [ -f "${PROJECT_DIR}/.env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "${PROJECT_DIR}/.env"
    set +a
    ok "Loaded .env"
  else
    warn "No .env.local found — using defaults from lib/config.ts"
  fi

  # Check PostgreSQL reachability
  PG_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/tourist_safety}"
  PG_HOST=$(echo "${PG_URL}" | sed -E 's|.*@([^:/]+).*|\1|')
  PG_PORT=$(echo "${PG_URL}" | sed -E 's|.*:([0-9]+)/.*|\1|')
  if nc -z "${PG_HOST}" "${PG_PORT}" 2>/dev/null; then
    ok "PostgreSQL reachable at ${PG_HOST}:${PG_PORT}"
  else
    warn "PostgreSQL not reachable at ${PG_HOST}:${PG_PORT}"
    warn "Run: ./scripts/backend.sh --db-only"
  fi

  # Check Redis reachability
  REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
  REDIS_HOST=$(echo "${REDIS_URL}" | sed -E 's|redis://([^:/]+).*|\1|')
  REDIS_PORT=$(echo "${REDIS_URL}" | sed -E 's|.*:([0-9]+).*|\1|')
  if nc -z "${REDIS_HOST}" "${REDIS_PORT}" 2>/dev/null; then
    ok "Redis reachable at ${REDIS_HOST}:${REDIS_PORT}"
  else
    warn "Redis not reachable at ${REDIS_HOST}:${REDIS_PORT}"
    warn "Some features (WebSocket, geofence pub/sub) will be degraded"
  fi
  echo ""
fi

# ── Build step (production only) ─────────────────────────────────────────────
if [ "${MODE}" = "prod" ]; then
  echo "[2/3] Building Next.js for production..."
  npm run build
  ok "Build complete"
  echo ""
else
  echo "[2/3] Skipping build (dev mode uses hot-reload)"
  echo ""
fi

# ── Auto-pick port if default is in use ──────────────────────────────────────
if nc -z localhost "${PORT}" 2>/dev/null; then
  OLD_PORT="${PORT}"
  PORT=$((PORT + 1))
  warn "Port ${OLD_PORT} already in use (server.ts?) — using port ${PORT} instead"
fi

# ── Start Next.js ─────────────────────────────────────────────────────────────
echo "[3/3] Starting Next.js..."

if [ "${MODE}" = "prod" ]; then
  info "Production server starting on port ${PORT}..."
  PORT="${PORT}" npx next start
else
  info "Dev server starting on port ${PORT} (hot-reload enabled)..."
  info "Note: Socket.IO is NOT available in dev mode — use backend.sh for full stack"
  PORT="${PORT}" npx next dev
fi
