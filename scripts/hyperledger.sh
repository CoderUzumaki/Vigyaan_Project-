#!/bin/bash
###############################################################################
# hyperledger.sh — Start the entire blockchain stack
#
# Starts (in order):
#   1. Redis (via Docker)
#   2. Hyperledger Fabric network (3 orgs, CouchDB, RAFT)
#   3. Extracts certs into connection profiles
#   4. Optionally starts the BullMQ worker
#
# Usage:
#   ./scripts/hyperledger.sh              # start everything
#   ./scripts/hyperledger.sh --no-worker  # skip the BullMQ worker
#   ./scripts/hyperledger.sh --status     # show status of all services
#   ./scripts/hyperledger.sh --stop       # tear everything down
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FABRIC_NETWORK_DIR="${PROJECT_DIR}/fabric-network"

# ── Parse arguments ──────────────────────────────────────────────────────────
START_WORKER=true
ACTION="start"
for arg in "$@"; do
  case "${arg}" in
    --no-worker)  START_WORKER=false ;;
    --status)     ACTION="status" ;;
    --stop)       ACTION="stop" ;;
    --help|-h)    ACTION="help" ;;
  esac
done

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

# ── Help ─────────────────────────────────────────────────────────────────────
show_help() {
  echo "Usage: ./scripts/hyperledger.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  (none)         Start all blockchain services"
  echo "  --no-worker    Start without the BullMQ worker"
  echo "  --status       Show status of all services"
  echo "  --stop         Stop all blockchain services"
  echo "  --help, -h     Show this help message"
  echo ""
  echo "Services started:"
  echo "  1. Redis (Docker container: safety-redis)"
  echo "  2. Hyperledger Fabric (3 orgs, CouchDB, RAFT)"
  echo "  3. BullMQ worker (Fabric event processor)"
}

# ─────────────────────────────────────────────────────────────────────────────
# STATUS — show what's running
# ─────────────────────────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Blockchain Stack Status${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""

  # Redis
  echo "[Redis]"
  if docker ps --filter "name=safety-redis" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "safety-redis is running (port 6379)"
  else
    fail "safety-redis is NOT running"
  fi
  echo ""

  # Fabric peers
  echo "[Fabric Peers]"
  for PEER in peer0.org1.example.com peer0.org2.example.com peer0.org3.example.com; do
    STATUS=$(docker ps --filter "name=${PEER}" --format "{{.Status}}" 2>/dev/null || true)
    if echo "${STATUS}" | grep -q "Up"; then
      ok "${PEER} is running"
    else
      fail "${PEER} is NOT running"
    fi
  done
  echo ""

  # Orderer
  echo "[Orderer]"
  if docker ps --filter "name=orderer.example.com" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "orderer.example.com is running"
  else
    fail "orderer.example.com is NOT running"
  fi
  echo ""

  # CouchDB
  echo "[CouchDB]"
  for PORT in 5984 7984 9984; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/" 2>/dev/null || true)
    if [ "${RESPONSE}" = "200" ] || [ "${RESPONSE}" = "401" ]; then
      ok "CouchDB on port ${PORT} is reachable"
    else
      fail "CouchDB on port ${PORT} is NOT reachable"
    fi
  done
  echo ""

  # Worker
  echo "[BullMQ Worker]"
  WORKER_PID=$(pgrep -f "fabricWorker\|startWorker" 2>/dev/null || true)
  if [ -n "${WORKER_PID}" ]; then
    ok "Worker is running (PID: ${WORKER_PID})"
  else
    warn "Worker is not running (start with: ./scripts/hyperledger.sh)"
  fi
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# STOP — tear everything down
# ─────────────────────────────────────────────────────────────────────────────
stop_all() {
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Stopping Blockchain Stack${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
  echo ""

  # Stop worker
  echo "[1/3] Stopping BullMQ worker..."
  WORKER_PID=$(pgrep -f "fabricWorker\|startWorker" 2>/dev/null || true)
  if [ -n "${WORKER_PID}" ]; then
    kill ${WORKER_PID} 2>/dev/null || true
    ok "Worker stopped (PID: ${WORKER_PID})"
  else
    info "Worker was not running"
  fi
  echo ""

  # Stop Redis
  echo "[2/3] Stopping Redis..."
  if docker ps --filter "name=safety-redis" --format "{{.Names}}" 2>/dev/null | grep -q "safety-redis"; then
    docker stop safety-redis >/dev/null 2>&1 || true
    docker rm safety-redis >/dev/null 2>&1 || true
    ok "Redis container stopped and removed"
  else
    info "Redis was not running"
  fi
  echo ""

  # Stop Fabric
  echo "[3/3] Stopping Fabric network..."
  if [ -x "${FABRIC_NETWORK_DIR}/scripts/startNetwork.sh" ]; then
    # Resolve fabric-samples for teardown
    if [ -d "${PROJECT_DIR}/../fabric-samples" ]; then
      FABRIC_SAMPLES_DIR="$(cd "${PROJECT_DIR}/../fabric-samples" && pwd)"
    elif [ -d "/tmp/fabric-samples" ]; then
      FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
    fi

    if [ -n "${FABRIC_SAMPLES_DIR:-}" ]; then
      TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
      if [ -d "${TEST_NETWORK_DIR}" ]; then
        cd "${TEST_NETWORK_DIR}"
        ./network.sh down 2>/dev/null || true
        ok "Fabric network stopped"
      fi
    else
      warn "Could not find fabric-samples — skip Fabric teardown"
    fi
  fi
  echo ""
  echo -e "${GREEN}All services stopped.${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# START — bring everything up
# ─────────────────────────────────────────────────────────────────────────────
start_all() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Starting Blockchain Stack${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""

  # ── Step 1: Docker check ─────────────────────────────────────────────────
  echo "[1/4] Checking Docker..."
  if ! docker info &>/dev/null; then
    fail "Docker is not running. Please start Docker and try again."
    exit 1
  fi
  ok "Docker is running"
  echo ""

  # ── Step 2: Start Redis ──────────────────────────────────────────────────
  echo "[2/4] Starting Redis..."
  if docker ps --filter "name=safety-redis" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    ok "Redis already running (safety-redis)"
  else
    # Remove stopped container if exists
    docker rm safety-redis 2>/dev/null || true

    docker run -d \
      --name safety-redis \
      -p 6379:6379 \
      --restart unless-stopped \
      redis:7-alpine \
      redis-server --appendonly yes \
      >/dev/null

    # Wait for Redis to be ready
    echo -n "  Waiting for Redis"
    for i in $(seq 1 10); do
      if docker exec safety-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        break
      fi
      echo -n "."
      sleep 1
    done
    echo ""
    ok "Redis started on port 6379"
  fi
  echo ""

  # ── Step 3: Start Fabric network ─────────────────────────────────────────
  echo "[3/4] Starting Hyperledger Fabric network..."

  # Check if peers are already running
  PEERS_RUNNING=true
  for PEER in peer0.org1.example.com peer0.org2.example.com peer0.org3.example.com; do
    if ! docker ps --filter "name=${PEER}" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
      PEERS_RUNNING=false
      break
    fi
  done

  if [ "${PEERS_RUNNING}" = true ]; then
    ok "Fabric network already running (3 peers + orderer)"
  else
    info "Starting Fabric network (this takes 1-2 minutes)..."
    if [ -x "${FABRIC_NETWORK_DIR}/scripts/startNetwork.sh" ]; then
      bash "${FABRIC_NETWORK_DIR}/scripts/startNetwork.sh"
      ok "Fabric network started"
    else
      fail "startNetwork.sh not found at ${FABRIC_NETWORK_DIR}/scripts/"
      fail "Please run: cd fabric-network && bash scripts/startNetwork.sh"
      exit 1
    fi
  fi
  echo ""

  # ── Step 4: Start BullMQ worker ──────────────────────────────────────────
  if [ "${START_WORKER}" = true ]; then
    echo "[4/4] Starting BullMQ worker..."

    # Kill existing worker if running
    WORKER_PID=$(pgrep -f "fabricWorker\|startWorker" 2>/dev/null || true)
    if [ -n "${WORKER_PID}" ]; then
      kill ${WORKER_PID} 2>/dev/null || true
      sleep 1
      warn "Stopped existing worker (PID: ${WORKER_PID})"
    fi

    # Set environment
    export REDIS_URL="redis://localhost:6379"
    export DATABASE_URL="${DATABASE_URL:-postgresql://admin:devpassword@localhost:5432/safetourism}"

    if [ -d "${PROJECT_DIR}/../fabric-samples" ]; then
      export FABRIC_SAMPLES_PATH="$(cd "${PROJECT_DIR}/../fabric-samples" && pwd)"
    elif [ -d "/tmp/fabric-samples" ]; then
      export FABRIC_SAMPLES_PATH="/tmp/fabric-samples"
    fi

    # Start worker in background
    cd "${PROJECT_DIR}"
    nohup npx tsx workers/startWorker.ts > /tmp/fabric-worker.log 2>&1 &
    WORKER_PID=$!
    sleep 2

    if kill -0 ${WORKER_PID} 2>/dev/null; then
      ok "Worker started (PID: ${WORKER_PID})"
      info "Logs: tail -f /tmp/fabric-worker.log"
    else
      warn "Worker may have failed — check: tail /tmp/fabric-worker.log"
    fi
  else
    echo "[4/4] Skipping BullMQ worker (--no-worker)"
  fi
  echo ""

  # ── Summary ──────────────────────────────────────────────────────────────
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Blockchain Stack Ready ✓${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Services:"
  echo "    Redis:       redis://localhost:6379"
  echo "    Org1 Peer:   localhost:7051  (TourismAuthority)"
  echo "    Org2 Peer:   localhost:9051  (EmergencyServices)"
  echo "    Org3 Peer:   localhost:11051 (Insurance)"
  echo "    Orderer:     localhost:7050  (RAFT)"
  echo "    CouchDB:     localhost:5984 / 7984 / 9984"
  echo ""
  echo "  Commands:"
  echo "    Status:      ./scripts/hyperledger.sh --status"
  echo "    Stop:        ./scripts/hyperledger.sh --stop"
  echo "    Worker logs: tail -f /tmp/fabric-worker.log"
  echo "    Smoke tests: ./fabric-network/scripts/testNetwork.sh"
  echo ""
}

# ── Run the selected action ──────────────────────────────────────────────────
case "${ACTION}" in
  start)   start_all ;;
  status)  show_status ;;
  stop)    stop_all ;;
  help)    show_help ;;
esac
