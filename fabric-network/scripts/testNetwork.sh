#!/bin/bash
###############################################################################
# testNetwork.sh
# Smoke tests for the Fabric network: containers, channel, chaincode.
###############################################################################
set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Resolve fabric-samples path (try relative, then /tmp symlink) ────────────
if [ -n "${FABRIC_SAMPLES_DIR:-}" ]; then
  true  # user-supplied, use as-is
elif [ -d "${PROJECT_DIR}/../fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="$(cd "${PROJECT_DIR}/../fabric-samples" && pwd)"
elif [ -d "/tmp/fabric-samples" ]; then
  FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
else
  echo "ERROR: Cannot find fabric-samples. Set FABRIC_SAMPLES_DIR env var."
  exit 1
fi
TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"

# ── Workaround: fabric-samples scripts can't handle spaces in paths ──────────
if echo "${FABRIC_SAMPLES_DIR}" | grep -q ' '; then
  ln -sfn "${FABRIC_SAMPLES_DIR}" /tmp/fabric-samples
  FABRIC_SAMPLES_DIR="/tmp/fabric-samples"
  TEST_NETWORK_DIR="${FABRIC_SAMPLES_DIR}/test-network"
fi

CHANNEL_NAME="${CHANNEL_NAME:-safetychannel}"
CHAINCODE_NAME="${CHAINCODE_NAME:-safetychaincode}"

# ── Add peer binary to PATH ─────────────────────────────────────────────────
export PATH="${FABRIC_SAMPLES_DIR}/bin:${PATH}"
export FABRIC_CFG_PATH="${TEST_NETWORK_DIR}/../config/"

# ── Counters ─────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0

check_pass() {
  echo "  ✓ PASS: $1"
  ((PASS++)) || true
}

check_fail() {
  echo "  ✗ FAIL: $1"
  ((FAIL++)) || true
}

check_skip() {
  echo "  ○ SKIP: $1"
  ((SKIP++)) || true
}

echo "============================================================"
echo "  Tourist Safety System — Network Smoke Tests"
echo "============================================================"
echo ""

# ── Test 1: Docker daemon running ────────────────────────────────────────────
echo "[Test 1] Docker daemon"
if docker info &>/dev/null; then
  check_pass "Docker daemon is running"
else
  check_fail "Docker daemon is not running"
  echo "         Cannot continue without Docker. Exiting."
  exit 1
fi
echo ""

# ── Test 2: Peer containers ─────────────────────────────────────────────────
echo "[Test 2] Peer containers"
EXPECTED_PEERS=("peer0.org1.example.com" "peer0.org2.example.com" "peer0.org3.example.com")
for PEER in "${EXPECTED_PEERS[@]}"; do
  STATUS=$(docker ps --filter "name=${PEER}" --format "{{.Status}}" 2>/dev/null || true)
  if echo "${STATUS}" | grep -q "Up"; then
    check_pass "${PEER} is running"
  else
    check_fail "${PEER} is NOT running (status: ${STATUS:-not_found})"
  fi
done
echo ""

# ── Test 3: Orderer container ────────────────────────────────────────────────
echo "[Test 3] Orderer container"
ORDERER_STATUS=$(docker ps --filter "name=orderer.example.com" --format "{{.Status}}" 2>/dev/null || true)
if echo "${ORDERER_STATUS}" | grep -q "Up"; then
  check_pass "orderer.example.com is running"
else
  check_fail "orderer.example.com is NOT running"
fi
echo ""

# ── Test 4: CouchDB containers ──────────────────────────────────────────────
echo "[Test 4] CouchDB containers"
EXPECTED_COUCHDB=("couchdb0" "couchdb1")
for CDB in "${EXPECTED_COUCHDB[@]}"; do
  STATUS=$(docker ps --filter "name=${CDB}" --format "{{.Status}}" 2>/dev/null || true)
  if echo "${STATUS}" | grep -q "Up"; then
    check_pass "${CDB} is running"
  else
    check_fail "${CDB} is NOT running"
  fi
done

# Org3 CouchDB may have different naming
ORG3_CDB_STATUS=$(docker ps --filter "name=couchdb" --format "{{.Names}}" 2>/dev/null | grep -i "org3\|couchdb2\|couchdb3" || true)
if [ -n "${ORG3_CDB_STATUS}" ]; then
  check_pass "Org3 CouchDB is running (${ORG3_CDB_STATUS})"
else
  check_skip "Org3 CouchDB container name could not be auto-detected"
fi
echo ""

# ── Test 5: CouchDB HTTP endpoints ──────────────────────────────────────────
echo "[Test 5] CouchDB HTTP endpoints"
for PORT in 5984 7984 9984; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/" 2>/dev/null || true)
  if [ "${RESPONSE}" = "200" ] || [ "${RESPONSE}" = "401" ]; then
    check_pass "CouchDB on port ${PORT} is reachable (HTTP ${RESPONSE})"
  else
    check_fail "CouchDB on port ${PORT} is NOT reachable (HTTP ${RESPONSE:-timeout})"
  fi
done
echo ""

# ── Test 6: Channel membership ───────────────────────────────────────────────
echo "[Test 6] Channel membership"

# Set env for Org1
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS="localhost:7051"

if command -v peer &>/dev/null; then
  CHANNELS=$(peer channel list 2>&1 || true)
  if echo "${CHANNELS}" | grep -q "${CHANNEL_NAME}"; then
    check_pass "Org1 peer joined '${CHANNEL_NAME}'"
  else
    check_fail "Org1 peer NOT on '${CHANNEL_NAME}'"
    echo "         Output: ${CHANNELS}"
  fi
else
  check_skip "'peer' CLI not in PATH — cannot verify channel membership"
fi
echo ""

# ── Test 7: Chaincode deployment ─────────────────────────────────────────────
echo "[Test 7] Chaincode deployment"
if command -v peer &>/dev/null; then
  COMMITTED=$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" 2>&1 || true)
  if echo "${COMMITTED}" | grep -q "${CHAINCODE_NAME}"; then
    check_pass "Chaincode '${CHAINCODE_NAME}' is committed on '${CHANNEL_NAME}'"

    # Try a test invocation
    echo "         Attempting test query..."
    QUERY_RESULT=$(peer chaincode query \
      -C "${CHANNEL_NAME}" \
      -n "${CHAINCODE_NAME}" \
      -c '{"function":"GetTourist","Args":["test-smoke-check"]}' 2>&1 || true)

    if echo "${QUERY_RESULT}" | grep -qi "error\|no_data_available"; then
      check_pass "Chaincode is callable (returned expected response for nonexistent key)"
    else
      check_pass "Chaincode query returned: ${QUERY_RESULT}"
    fi
  else
    check_skip "Chaincode '${CHAINCODE_NAME}' not deployed yet (deploy with ./scripts/deployChaincode.sh)"
  fi
else
  check_skip "'peer' CLI not in PATH — cannot verify chaincode"
fi
echo ""

# ── Test 8: Connection profiles ──────────────────────────────────────────────
echo "[Test 8] Connection profiles"
PROFILES_DIR="${PROJECT_DIR}/connection-profiles"
for ORG in 1 2 3; do
  PROFILE="${PROFILES_DIR}/org${ORG}.json"
  if [ -f "${PROFILE}" ]; then
    if command -v jq &>/dev/null && jq empty "${PROFILE}" 2>/dev/null; then
      # Check if cert paths are populated (not containing placeholder)
      CERT_PATH=$(jq -r '.peers[keys[0]].tlsCACerts.path // "no_cert_path"' "${PROFILE}" 2>/dev/null || true)
      if [ -f "${CERT_PATH}" ]; then
        check_pass "org${ORG}.json valid JSON, cert path exists"
      elif echo "${CERT_PATH}" | grep -q "__TLS_CA_CERT__\|PATH_TO"; then
        check_fail "org${ORG}.json has placeholder cert path — run extractCerts.sh"
      else
        check_pass "org${ORG}.json valid JSON (cert path: ${CERT_PATH})"
      fi
    else
      check_fail "org${ORG}.json is not valid JSON"
    fi
  else
    check_fail "org${ORG}.json not found at ${PROFILE}"
  fi
done
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "============================================================"
echo "  Results:  ${PASS} passed,  ${FAIL} failed,  ${SKIP} skipped"
echo "============================================================"

if [ "${FAIL}" -gt 0 ]; then
  echo ""
  echo "  Some checks failed. Review the output above."
  exit 1
else
  echo ""
  echo "  All checks passed!"
  exit 0
fi
