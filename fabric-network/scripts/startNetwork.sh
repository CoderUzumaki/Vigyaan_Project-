#!/bin/bash
###############################################################################
# startNetwork.sh
# Starts the Hyperledger Fabric 2.5 test-network with 3 organisations,
# CouchDB state databases, and RAFT consensus on channel "safetychannel".
###############################################################################
set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load environment variables if .env exists
if [ -f "${PROJECT_DIR}/.env" ]; then
  # shellcheck source=/dev/null
  source "${PROJECT_DIR}/.env"
fi

# ── Resolve fabric-samples path (try relative, then /tmp symlink) ────────────
if [ -n "${FABRIC_SAMPLES_DIR:-}" ]; then
  true
elif [ -d "${PROJECT_DIR}/../fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="$(cd "${PROJECT_DIR}/../fabric-samples" && pwd)"
elif [ -d "${PROJECT_DIR}/../../fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="$(cd "${PROJECT_DIR}/../../fabric-samples" && pwd)"
elif [ -d "/tmp/fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
else
  echo "ERROR: Cannot find fabric-samples. Set FABRIC_SAMPLES_DIR env var."
  exit 1
fi
TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
CHANNEL_NAME="${CHANNEL_NAME:-safetychannel}"

# ── Workaround: fabric-samples scripts can't handle spaces in paths ──────────
# Create a symlink at /tmp/fabric-samples to avoid path-with-spaces issues.
if echo "${FABRIC_SAMPLES_DIR}" | grep -q ' '; then
  echo "NOTE: Path contains spaces — creating symlink at /tmp/fabric-samples"
  ln -sfn "${FABRIC_SAMPLES_DIR}" /tmp/fabric-samples
  FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
  TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
fi

# ── Validate fabric-samples exists ───────────────────────────────────────────
if [ ! -d "${TEST_NETWORK_DIR}" ]; then
  echo "ERROR: fabric-samples test-network not found at ${TEST_NETWORK_DIR}"
  echo ""
  echo "Please clone fabric-samples first:"
  echo "  git clone https://github.com/hyperledger/fabric-samples.git"
  echo "  cd fabric-samples"
  echo "  curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7"
  exit 1
fi

echo "============================================================"
echo "  Tourist Safety System — Fabric Network Startup"
echo "============================================================"
echo ""

# ── Step 1: Tear down existing network ───────────────────────────────────────
echo "[1/5] Stopping existing network..."
cd "${TEST_NETWORK_DIR}"
./network.sh down 2>/dev/null || true
echo "      ✓ Network cleaned"
echo ""

# ── Step 2: Start 2-org base network with CouchDB ───────────────────────────
echo "[2/5] Starting network with Org1 + Org2 + CouchDB..."
./network.sh up createChannel -ca -s couchdb -c "${CHANNEL_NAME}"
echo "      ✓ Base network running on channel '${CHANNEL_NAME}'"
echo ""

# ── Step 3: Add Org3 (Insurance) ─────────────────────────────────────────────
echo "[3/5] Adding Org3 (Insurance)..."
cd "${TEST_NETWORK_DIR}/addOrg3"
./addOrg3.sh up -c "${CHANNEL_NAME}" -s couchdb
echo "      ✓ Org3 joined channel '${CHANNEL_NAME}'"
echo ""

# ── Step 4: Extract certs and update connection profiles ─────────────────────
echo "[4/5] Extracting certificates into connection profiles..."
if [ -x "${SCRIPT_DIR}/extractCerts.sh" ]; then
  bash "${SCRIPT_DIR}/extractCerts.sh"
  echo "      ✓ Connection profiles updated"
else
  echo "      ⚠ extractCerts.sh not found or not executable — skipping"
fi
echo ""

# ── Step 5: Print summary ────────────────────────────────────────────────────
echo "[5/5] Network ready!"
echo ""
echo "──── Peer Containers ────"
docker ps --filter "name=peer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "──── Orderer ────"
docker ps --filter "name=orderer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "──── Organisation Mapping ────"
echo "  Org1MSP  →  TourismAuthority     peer0.org1.example.com:7051"
echo "  Org2MSP  →  EmergencyServices    peer0.org2.example.com:9051"
echo "  Org3MSP  →  Insurance            peer0.org3.example.com:11051"
echo ""
echo "──── CouchDB UIs ────"
echo "  Org1: http://localhost:5984/_utils  (admin / adminpw)"
echo "  Org2: http://localhost:7984/_utils  (admin / adminpw)"
echo "  Org3: http://localhost:9984/_utils  (admin / adminpw)"
echo ""
echo "──── Next Steps ────"
echo "  1. Deploy chaincode:  ./scripts/deployChaincode.sh"
echo "  2. Run smoke tests:   ./scripts/testNetwork.sh"
echo "============================================================"
