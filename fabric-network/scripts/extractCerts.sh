#!/bin/bash
###############################################################################
# extractCerts.sh
# Reads real TLS CA certificate paths from the running fabric-samples
# test-network and writes them into the connection-profile JSON files.
# Requires: jq
###############################################################################
set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Resolve fabric-samples path (try relative, then /tmp symlink) ────────────
if [ -n "${FABRIC_SAMPLES_DIR:-}" ]; then
  true
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

PROFILES_DIR="${PROJECT_DIR}/connection-profiles"

# ── Dependency check ─────────────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed."
  echo "  Ubuntu/Debian: sudo apt-get install jq"
  echo "  macOS:         brew install jq"
  exit 1
fi

# ── Helper: resolve and validate cert path ───────────────────────────────────
resolve_cert() {
  local ORG_NUM="$1"
  local PEER_DOMAIN="$2"
  local CERT_PATH="${TEST_NETWORK_DIR}/organizations/peerOrganizations/${PEER_DOMAIN}/peers/peer0.${PEER_DOMAIN}/tls/ca.crt"

  if [ ! -f "${CERT_PATH}" ]; then
    echo "ERROR: TLS CA cert not found for Org${ORG_NUM} at:"
    echo "  ${CERT_PATH}"
    echo "  Is the network running? Try: ./scripts/startNetwork.sh"
    exit 1
  fi

  # Return absolute path
  echo "$(cd "$(dirname "${CERT_PATH}")" && pwd)/$(basename "${CERT_PATH}")"
}

resolve_ca_cert() {
  local ORG_NUM="$1"
  local PEER_DOMAIN="$2"
  local CA_CERT_PATH="${TEST_NETWORK_DIR}/organizations/peerOrganizations/${PEER_DOMAIN}/ca/ca.${PEER_DOMAIN}-cert.pem"

  if [ ! -f "${CA_CERT_PATH}" ]; then
    echo "WARNING: CA cert not found for Org${ORG_NUM} at: ${CA_CERT_PATH}"
    echo ""
    return 0
  fi
  echo "$(cd "$(dirname "${CA_CERT_PATH}")" && pwd)/$(basename "${CA_CERT_PATH}")"
}

# ── Define org configs ───────────────────────────────────────────────────────
declare -A ORG_DOMAINS=(
  [1]="org1.example.com"
  [2]="org2.example.com"
  [3]="org3.example.com"
)

declare -A ORG_PORTS=(
  [1]="7051"
  [2]="9051"
  [3]="11051"
)

declare -A CA_PORTS=(
  [1]="7054"
  [2]="8054"
  [3]="11054"
)

# ── Process each org ─────────────────────────────────────────────────────────
echo "Extracting TLS certificates into connection profiles..."
echo ""

for ORG_NUM in 1 2 3; do
  DOMAIN="${ORG_DOMAINS[$ORG_NUM]}"
  PORT="${ORG_PORTS[$ORG_NUM]}"
  CA_PORT="${CA_PORTS[$ORG_NUM]}"
  PROFILE="${PROFILES_DIR}/org${ORG_NUM}.json"

  if [ ! -f "${PROFILE}" ]; then
    echo "  ⚠ Skipping Org${ORG_NUM}: ${PROFILE} not found"
    continue
  fi

  # Resolve certs
  TLS_CERT="$(resolve_cert "${ORG_NUM}" "${DOMAIN}")"
  CA_CERT="$(resolve_ca_cert "${ORG_NUM}" "${DOMAIN}")"

  echo "  Org${ORG_NUM} (${DOMAIN}):"
  echo "    TLS CA cert: ${TLS_CERT}"

  # Update TLS cert path in connection profile
  PEER_KEY="peer0.${DOMAIN}"
  TEMP_FILE=$(mktemp)

  jq --arg tlsCert "${TLS_CERT}" \
     --arg caUrl "https://localhost:${CA_PORT}" \
     --arg caCert "${CA_CERT:-no_ca_cert_available}" \
     '
       .peers[keys[0]].tlsCACerts.path = $tlsCert
       | if .certificateAuthorities then
           .certificateAuthorities[keys[0]].url = $caUrl
           | .certificateAuthorities[keys[0]].tlsCACerts.path = $caCert
         else . end
     ' "${PROFILE}" > "${TEMP_FILE}"

  mv "${TEMP_FILE}" "${PROFILE}"
  echo "    ✓ Updated ${PROFILE}"
  echo ""
done

echo "All connection profiles updated successfully."
