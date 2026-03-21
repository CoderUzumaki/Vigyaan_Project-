#!/bin/bash
###############################################################################
# backend.sh — Start the backend services for the Tourist Safety System
#
# Starts (in order):
#   1. PostgreSQL + Redis + Adminer via Docker Compose
#   2. Waits for PostgreSQL to be ready
#   3. Starts the custom Next.js server (server.ts) with Socket.IO
#
# The custom server handles both Next.js API routes and real-time WebSockets.
#
# Usage:
#   ./scripts/backend.sh              # start all backend services
#   ./scripts/backend.sh --db-only    # start only Docker services (no Next.js)
#   ./scripts/backend.sh --status     # show status of backend services
#   ./scripts/backend.sh --stop       # stop Docker services
#   ./scripts/backend.sh --help, -h   # show this help message
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Parse arguments ──────────────────────────────────────────────────────────
DB_ONLY=false
ACTION="start"
for arg in "$@"; do
  case "${arg}" in
    --db-only)  DB_ONLY=true ;;
    --status)   ACTION="status" ;;
    --stop)     ACTION="stop" ;;
    --help|-h)  ACTION="help" ;;
  esac
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

# ── Help ─────────────────────────────────────────────────────────────────────
show_help() {
  echo "Usage: ./scripts/backend.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  (none)         Start PostgreSQL, Redis, Adminer, and the Next.js server"
  echo "  --db-only      Start only Docker services (PostgreSQL, Redis, Adminer)"
  echo "  --status       Show status of all backend services"
  echo "  --stop         Stop Docker services"
  echo "  --help, -h     Show this help message"
  echo ""
  echo "Services started:"
  echo "  1. PostgreSQL  (port 5432)  — tourist_safety database"
  echo "  2. Redis       (port 6379)  — session cache + pub/sub"
  echo "  3. Adminer     (port 8080)  — database web UI"
  echo "  4. Next.js     (port 3000)  — API routes + Socket.IO server"
}

# ── STATUS ───────────────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Backend Services Status${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""

  echo "[Docker Compose]"
  if docker ps --filter "name=tourist-postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "PostgreSQL is running (port 5432)"
  else
    fail "PostgreSQL is NOT running"
  fi
  if docker ps --filter "name=safety-redis" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "Redis is running (port 6379)"
  else
    fail "Redis is NOT running (run: ./scripts/backend.sh)"
  fi
  if docker ps --filter "name=tourist-adminer" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "Adminer is running (http://localhost:8080)"
  else
    warn "Adminer is NOT running"
  fi
  echo ""

  echo "[Next.js Server]"
  SERVER_PID=$(pgrep -f "server.ts\|next.*server" 2>/dev/null || true)
  if [ -n "${SERVER_PID}" ]; then
    ok "Next.js server is running (PID: ${SERVER_PID}, port 3000)"
  else
    warn "Next.js server is not running (start with: ./scripts/backend.sh)"
  fi
  echo ""
}

# ── STOP ─────────────────────────────────────────────────────────────────────
stop_all() {
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Stopping Backend Services${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
  echo ""

  echo "[1/2] Stopping Next.js server..."
  SERVER_PID=$(pgrep -f "tsx.*server.ts" 2>/dev/null || true)
  if [ -n "${SERVER_PID}" ]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    ok "Next.js server stopped (PID: ${SERVER_PID})"
  else
    info "Next.js server was not running"
  fi
  echo ""

  echo "[2/2] Stopping Docker services..."
  cd "${PROJECT_DIR}"
  if docker compose ps --quiet 2>/dev/null | grep -q .; then
    docker compose down
    ok "Docker services stopped"
  else
    info "Docker services were not running"
  fi
  echo ""
  echo -e "${GREEN}All backend services stopped.${NC}"
}

# ── START ─────────────────────────────────────────────────────────────────────
start_all() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Starting Backend Services${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""

  # ── Step 1: Docker check ─────────────────────────────────────────────────
  echo "[1/3] Checking Docker..."
  if ! docker info &>/dev/null; then
    fail "Docker is not running. Please start Docker and try again."
    exit 1
  fi
  ok "Docker is running"
  echo ""

  # ── Step 2: Start Docker Compose services ────────────────────────────────
  echo "[2/3] Starting PostgreSQL, Redis, and Adminer..."
  cd "${PROJECT_DIR}"

  REDIS_EXTERNAL=false
  if docker ps --filter "name=safety-redis" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    # Redis already running externally (e.g. from hyperledger.sh) — skip it in compose
    REDIS_EXTERNAL=true
    warn "Redis already running externally — compose will start postgres+adminer only"
  fi

  if docker ps --filter "name=tourist-postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "PostgreSQL already running (tourist-postgres)"
  else
    if [ "${REDIS_EXTERNAL}" = true ]; then
      # Start only postgres and adminer to avoid naming conflict with existing redis
      docker compose up -d postgres adminer
    else
      docker compose up -d
    fi

    echo ""
    info "Waiting for PostgreSQL to be ready..."
    MAX_WAIT=60
    ELAPSED=0
    until docker exec tourist-postgres pg_isready -U postgres -d tourist_safety &>/dev/null; do
      if [ "${ELAPSED}" -ge "${MAX_WAIT}" ]; then
        fail "PostgreSQL did not become ready within ${MAX_WAIT}s"
        fail "Check logs: docker logs tourist-postgres"
        exit 1
      fi
      sleep 2
      ELAPSED=$((ELAPSED + 2))
      echo -n "."
    done
    echo ""
    ok "PostgreSQL is ready (port 5432)"
    if [ "${REDIS_EXTERNAL}" = false ]; then
      ok "Redis is ready (port 6379)"
    fi
    ok "Adminer is available at http://localhost:8080"
  fi
  echo ""

  # ── Step 3: Start Next.js server ─────────────────────────────────────────
  if [ "${DB_ONLY}" = true ]; then
    echo "[3/3] Skipping Next.js server (--db-only)"
  else
    echo "[3/3] Starting Next.js server (Socket.IO + API routes)..."

    # Kill existing server if running
    SERVER_PID=$(pgrep -f "tsx.*server.ts" 2>/dev/null || true)
    if [ -n "${SERVER_PID}" ]; then
      kill "${SERVER_PID}" 2>/dev/null || true
      sleep 1
      warn "Stopped existing server (PID: ${SERVER_PID})"
    fi

    # Load .env.local if it exists
    if [ -f "${PROJECT_DIR}/.env.local" ]; then
      set -a
      # shellcheck disable=SC1090
      source "${PROJECT_DIR}/.env.local"
      set +a
      info "Loaded environment from .env.local"
    fi

    # Start the custom server in background
    cd "${PROJECT_DIR}"
    nohup npx tsx server.ts > /tmp/next-server.log 2>&1 &
    SERVER_PID=$!
    sleep 3

    if kill -0 "${SERVER_PID}" 2>/dev/null; then
      ok "Next.js server started (PID: ${SERVER_PID})"
      info "Logs: tail -f /tmp/next-server.log"
    else
      fail "Next.js server failed to start — check: tail /tmp/next-server.log"
      exit 1
    fi
  fi
  echo ""

  # ── Summary ──────────────────────────────────────────────────────────────
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Backend Ready ✓${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Services:"
  echo "    PostgreSQL:  postgresql://postgres:postgres@localhost:5432/tourist_safety"
  echo "    Redis:       redis://localhost:6379"
  echo "    Adminer:     http://localhost:8080"
  if [ "${DB_ONLY}" = false ]; then
    echo "    API + WS:    http://localhost:3000"
  fi
  echo ""
  echo "  Commands:"
  echo "    Status:      ./scripts/backend.sh --status"
  echo "    Stop:        ./scripts/backend.sh --stop"
  if [ "${DB_ONLY}" = false ]; then
    echo "    Logs:        tail -f /tmp/next-server.log"
  fi
  echo ""
}

# ── Run selected action ──────────────────────────────────────────────────────
case "${ACTION}" in
  start)   start_all ;;
  status)  show_status ;;
  stop)    stop_all ;;
  help)    show_help ;;
esac
