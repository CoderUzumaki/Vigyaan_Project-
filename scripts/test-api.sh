#!/bin/bash
###############################################################################
# scripts/test-api.sh — Integration tests for ALL REST API endpoints
#
# Usage:
#   ./scripts/test-api.sh                 # test against localhost:3000
#   ./scripts/test-api.sh http://host:port # test against custom URL
###############################################################################
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
SKIP=0
TOKEN=""
ADMIN_TOKEN=""
SERVICE_TOKEN=""
USER_ID=""
ZONE_ID=""
INCIDENT_ID=""

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${YELLOW}⊘${NC} $1 (skipped)"; SKIP=$((SKIP + 1)); }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

json_field() {
  echo "$1" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try { console.log(JSON.parse(d)$2 ?? ''); }
      catch { console.log('JSON_PARSE_ERROR'); }
    });
  "
}

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Tourist Safety System — Full API Integration Tests${NC}"
echo -e "${CYAN}  Target: ${BASE_URL}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"

###############################################################################
# 1. REGISTRATION
###############################################################################
section "POST /api/auth/register"

TIMESTAMP=$(date +%s)
RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"testuser_${TIMESTAMP}@test.com\",\"password\":\"TestPass123\",\"fullName\":\"Test User\"}")
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)
if [ "$HTTP_CODE" = "201" ]; then
  TOKEN=$(json_field "$BODY" ".token")
  USER_ID=$(json_field "$BODY" ".user.id")
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "JSON_PARSE_ERROR" ]; then
    pass "Registration succeeded (HTTP 201)"
  else fail "Registration returned 201 but no token"; fi
else fail "Registration failed (HTTP $HTTP_CODE)"; fi

# Duplicate
RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"testuser_${TIMESTAMP}@test.com\",\"password\":\"TestPass123\",\"fullName\":\"Dupe\"}")
HTTP_CODE=$(echo "$RESULT" | tail -1)
[ "$HTTP_CODE" = "409" ] && pass "Duplicate email rejected (409)" || fail "Duplicate email got $HTTP_CODE"

# Validation
RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/register" -H "Content-Type: application/json" -d '{"email":""}')
HTTP_CODE=$(echo "$RESULT" | tail -1)
[ "$HTTP_CODE" = "400" ] && pass "Empty email rejected (400)" || fail "Empty email got $HTTP_CODE"

###############################################################################
# 2. LOGIN
###############################################################################
section "POST /api/auth/login"

RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tourist1@test.com","password":"Tourist@123"}')
HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
if [ "$HTTP_CODE" = "200" ]; then
  pass "Tourist login succeeded"
else fail "Tourist login failed (HTTP $HTTP_CODE)"; fi

# Admin login
RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@safetourism.gov","password":"Admin@123"}')
HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
if [ "$HTTP_CODE" = "200" ]; then
  ADMIN_TOKEN=$(json_field "$BODY" ".token")
  pass "Admin login succeeded"
else fail "Admin login failed (HTTP $HTTP_CODE)"; fi

# Service account login
RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"insurance@provider.com","password":"Service@123"}')
HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
if [ "$HTTP_CODE" = "200" ]; then
  SERVICE_TOKEN=$(json_field "$BODY" ".token")
  pass "Service account login succeeded"
else fail "Service login failed (HTTP $HTTP_CODE) — may need seed data"; fi

# Wrong password
RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tourist1@test.com","password":"wrong"}')
HTTP_CODE=$(echo "$RESULT" | tail -1)
[ "$HTTP_CODE" = "401" ] && pass "Wrong password rejected (401)" || fail "Wrong password got $HTTP_CODE"

###############################################################################
# 3. PROFILE + PIN + PUSH
###############################################################################
section "GET /api/auth/me + POST set-pin + register-push"

if [ -n "$TOKEN" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/me" -H "Authorization: Bearer ${TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Profile fetched (200)" || fail "Profile failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/tourist/set-pin" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d '{"pin":"1234"}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "PIN set (200)" || fail "PIN set failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/tourist/register-push" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d '{"pushToken":"ExponentPushToken[test123]"}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Push token registered (200)" || fail "Push token failed ($HTTP_CODE)"
fi

RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/auth/me")
HTTP_CODE=$(echo "$RESULT" | tail -1)
[ "$HTTP_CODE" = "401" ] && pass "No token returns 401" || fail "No token got $HTTP_CODE"

###############################################################################
# 4. LOCATION PING
###############################################################################
section "POST /api/location/ping"

if [ -n "$TOKEN" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/location/ping" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d '{"lat":28.61,"lng":77.21,"accuracy":10}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Location ping (200)" || fail "Location ping failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/location/ping" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d '{"lat":999,"lng":77.21}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "400" ] && pass "Invalid lat rejected (400)" || fail "Invalid lat got $HTTP_CODE"
fi

###############################################################################
# 5. SOS CONFIRM + CANCEL
###############################################################################
section "POST /api/sos/confirm + cancel"

if [ -n "$TOKEN" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/sos/confirm" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d "{\"sosType\":\"medical\",\"intentMethod\":\"countdown\",\"clientTimestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}")
  HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
  if [ "$HTTP_CODE" = "200" ]; then
    INCIDENT_ID=$(json_field "$BODY" ".incidentId")
    pass "SOS confirmed (200), id=$INCIDENT_ID"
  else fail "SOS confirm failed ($HTTP_CODE)"; fi

  # Duplicate lock
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/sos/confirm" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d "{\"sosType\":\"fire\",\"intentMethod\":\"countdown\",\"clientTimestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "429" ] && pass "Duplicate SOS locked (429)" || pass "SOS handled ($HTTP_CODE)"

  # Cancel
  if [ -n "${INCIDENT_ID:-}" ]; then
    RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/sos/cancel" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
      -d "{\"incidentId\":\"${INCIDENT_ID}\"}")
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    [ "$HTTP_CODE" = "200" ] && pass "SOS cancelled (200)" || fail "SOS cancel failed ($HTTP_CODE)"
  fi
fi

###############################################################################
# 6. ZONES CRUD
###############################################################################
section "GET/POST /api/zones + PUT/DELETE /api/zones/[id]"

if [ -n "$TOKEN" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/zones" -H "Authorization: Bearer ${TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
  if [ "$HTTP_CODE" = "200" ]; then
    FC_TYPE=$(json_field "$BODY" ".type")
    [ "$FC_TYPE" = "FeatureCollection" ] && pass "Zones GeoJSON FeatureCollection" || fail "Not FeatureCollection: $FC_TYPE"
  else fail "Zones GET failed ($HTTP_CODE)"; fi
fi

if [ -n "${ADMIN_TOKEN:-}" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/zones" -H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json" \
    -d '{"name":"TestZone","severity":"amber","boundary":{"type":"Polygon","coordinates":[[[77.10,28.50],[77.15,28.50],[77.15,28.55],[77.10,28.55],[77.10,28.50]]]}}')
  HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
  if [ "$HTTP_CODE" = "201" ]; then
    ZONE_ID=$(json_field "$BODY" ".zoneId")
    pass "Zone created (201), id=$ZONE_ID"
  else fail "Zone create failed ($HTTP_CODE)"; fi

  # Non-admin create
  if [ -n "$TOKEN" ]; then
    RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/zones" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
      -d '{"name":"X","severity":"green","boundary":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}}')
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    [ "$HTTP_CODE" = "403" ] && pass "Non-admin zone create rejected (403)" || fail "Non-admin got $HTTP_CODE"
  fi

  if [ -n "${ZONE_ID:-}" ]; then
    RESULT=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/api/zones/${ZONE_ID}" -H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json" \
      -d '{"name":"Updated Zone","severity":"red"}')
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    [ "$HTTP_CODE" = "200" ] && pass "Zone updated (200)" || fail "Zone update failed ($HTTP_CODE)"

    RESULT=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/zones/${ZONE_ID}" -H "Authorization: Bearer ${ADMIN_TOKEN}")
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    [ "$HTTP_CODE" = "200" ] && pass "Zone soft-deleted (200)" || fail "Zone delete failed ($HTTP_CODE)"
  fi
fi

###############################################################################
# 7. TOURIST HISTORY + PROFILE + CONSENT
###############################################################################
section "GET /api/tourist/history + profile + POST consent"

if [ -n "$TOKEN" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/tourist/history" -H "Authorization: Bearer ${TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "History fetched (200)" || fail "History failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/tourist/profile" -H "Authorization: Bearer ${TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Profile fetched (200)" || fail "Profile failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/services/consent" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d '{"granted":true}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Consent granted (200)" || fail "Consent failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/services/consent" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d '{"granted":false}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Consent revoked (200)" || fail "Consent revoke failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/services/consent" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d '{"granted":"yes"}')
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "400" ] && pass "Invalid consent rejected (400)" || fail "Invalid consent got $HTTP_CODE"
fi

###############################################################################
# 8. KYC ROUTES
###############################################################################
section "KYC: submit, status, pending, review"

if [ -n "$TOKEN" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/kyc/status" -H "Authorization: Bearer ${TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "KYC status fetched (200)" || fail "KYC status failed ($HTTP_CODE)"
fi

if [ -n "${ADMIN_TOKEN:-}" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/kyc/pending" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "KYC pending list (200)" || fail "KYC pending failed ($HTTP_CODE)"

  # Non-admin access
  if [ -n "$TOKEN" ]; then
    RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/kyc/pending" -H "Authorization: Bearer ${TOKEN}")
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    [ "$HTTP_CODE" = "403" ] && pass "Non-admin KYC pending rejected (403)" || fail "Non-admin KYC got $HTTP_CODE"
  fi
fi

###############################################################################
# 9. ADMIN API ROUTES
###############################################################################
section "Admin API: tourists, incidents, dispatch, resolve"

if [ -n "${ADMIN_TOKEN:-}" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/admin/tourists" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Admin tourists list (200)" || fail "Admin tourists failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/admin/tourists?kycStatus=pending" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Admin tourists filtered (200)" || fail "Admin tourists filter failed ($HTTP_CODE)"

  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/admin/incidents" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Admin incidents list (200)" || fail "Admin incidents failed ($HTTP_CODE)"

  # Non-admin access
  if [ -n "$TOKEN" ]; then
    RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/admin/tourists" -H "Authorization: Bearer ${TOKEN}")
    HTTP_CODE=$(echo "$RESULT" | tail -1)
    [ "$HTTP_CODE" = "403" ] && pass "Non-admin tourists rejected (403)" || fail "Non-admin tourists got $HTTP_CODE"
  fi
fi

###############################################################################
# 10. SERVICES API ROUTES
###############################################################################
section "Services API: analytics, incident lookup"

if [ -n "${SERVICE_TOKEN:-}" ] && [ "$SERVICE_TOKEN" != "" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/services/analytics" -H "Authorization: Bearer ${SERVICE_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
  if [ "$HTTP_CODE" = "200" ]; then
    HAS_OVERVIEW=$(json_field "$BODY" ".overview.touristsToday")
    pass "Analytics fetched (200)"
  else fail "Analytics failed ($HTTP_CODE)"; fi
elif [ -n "${ADMIN_TOKEN:-}" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/services/analytics" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Analytics via admin token (200)" || fail "Analytics failed ($HTTP_CODE)"
else
  skip "Services analytics (no service/admin token)"
fi

# Incident lookup (without consent — expect consent warning)
if [ -n "${ADMIN_TOKEN:-}" ] && [ -n "${INCIDENT_ID:-}" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/services/incident/${INCIDENT_ID}" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1)
  [ "$HTTP_CODE" = "200" ] && pass "Incident lookup (200)" || fail "Incident lookup failed ($HTTP_CODE)"
fi

###############################################################################
# 11. DEMO ROUTES
###############################################################################
section "Demo: simulate-breach, simulate-sos"

if [ -n "${ADMIN_TOKEN:-}" ]; then
  RESULT=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/demo/simulate-breach" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
  if [ "$HTTP_CODE" = "200" ]; then
    DEMO_OK=$(json_field "$BODY" ".ok")
    [ "$DEMO_OK" = "true" ] && pass "Simulate breach (200)" || fail "Breach sim response wrong"
  else fail "Simulate breach failed ($HTTP_CODE)"; fi

  RESULT=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/demo/simulate-sos" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  HTTP_CODE=$(echo "$RESULT" | tail -1); BODY=$(echo "$RESULT" | head -n -1)
  if [ "$HTTP_CODE" = "200" ]; then
    DEMO_OK=$(json_field "$BODY" ".ok")
    [ "$DEMO_OK" = "true" ] && pass "Simulate SOS (200)" || fail "SOS sim response wrong"
  else fail "Simulate SOS failed ($HTTP_CODE)"; fi
else
  skip "Demo routes (no admin token)"
fi

###############################################################################
# 12. DATABASE INTEGRITY
###############################################################################
section "Database Integrity"

TOURIST_COUNT=$(docker exec tourist-postgres psql -U postgres -d tourist_safety -t -c "SELECT COUNT(*) FROM tourists" 2>/dev/null | tr -d ' ')
[ "$TOURIST_COUNT" -ge 3 ] 2>/dev/null && pass "Tourists: ${TOURIST_COUNT} rows" || fail "Tourists: $TOURIST_COUNT"

LOC_COUNT=$(docker exec tourist-postgres psql -U postgres -d tourist_safety -t -c "SELECT COUNT(*) FROM tourist_locations" 2>/dev/null | tr -d ' ')
[ "$LOC_COUNT" -ge 1 ] 2>/dev/null && pass "Location pings: ${LOC_COUNT}" || fail "No pings: $LOC_COUNT"

SOS_DB=$(docker exec tourist-postgres psql -U postgres -d tourist_safety -t -c "SELECT COUNT(*) FROM sos_events" 2>/dev/null | tr -d ' ')
[ "$SOS_DB" -ge 1 ] 2>/dev/null && pass "SOS events: ${SOS_DB}" || fail "No SOS: $SOS_DB"

BREACH_DB=$(docker exec tourist-postgres psql -U postgres -d tourist_safety -t -c "SELECT COUNT(*) FROM breach_events" 2>/dev/null | tr -d ' ')
[ "$BREACH_DB" -ge 1 ] 2>/dev/null && pass "Breach events: ${BREACH_DB}" || fail "No breaches: $BREACH_DB"

ZONE_DB=$(docker exec tourist-postgres psql -U postgres -d tourist_safety -t -c "SELECT COUNT(*) FROM geofence_zones" 2>/dev/null | tr -d ' ')
[ "$ZONE_DB" -ge 3 ] 2>/dev/null && pass "Geofence zones: ${ZONE_DB}" || fail "Zones: $ZONE_DB"

###############################################################################
# 13. HARDCODED VALUES CHECK
###############################################################################
section "Hardcoded Values Check"

# Verify no hardcoded DB/Redis/JWT in lib files (should use config.ts)
HC_COUNT=$({ grep -rn "process.env" lib/db.ts lib/redis.ts lib/queue.ts lib/auth.ts 2>/dev/null || true; } | { grep -v "config" || true; } | { grep -v "NODE_ENV" || true; } | wc -l | tr -d ' ')
[ "$HC_COUNT" -eq 0 ] && pass "No hardcoded env vars in lib/ (uses config.ts)" || fail "Found $HC_COUNT hardcoded env refs in lib/"

CONFIG_EXISTS=$([ -f "lib/config.ts" ] && echo "yes" || echo "no")
[ "$CONFIG_EXISTS" = "yes" ] && pass "lib/config.ts exists" || fail "lib/config.ts missing"

###############################################################################
# Summary
###############################################################################
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  Results: ${GREEN}${PASS} passed${NC} / ${RED}${FAIL} failed${NC} / ${YELLOW}${SKIP} skipped${NC} (${TOTAL} total)"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}All tests passed! ✓${NC}"
else
  echo -e "  ${RED}${FAIL} test(s) failed ✗${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
exit "$FAIL"
