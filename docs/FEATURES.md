# Tourist Safety System — Feature Documentation

## System Components

### 1. Hyperledger Fabric Network
- **3-org network** (Tourism Authority, Emergency Services, Insurance) on `safetychannel`
- CouchDB state databases, RAFT consensus, TLS-enabled
- Scripts: `startNetwork.sh`, `deployChaincode.sh`, `testNetwork.sh`, `extractCerts.sh`
- **14/14 smoke tests pass**

### 2. Go Chaincode (`chaincode/safetychaincode/`)
- **15 functions** across 3 orgs with full validation and event emission
- Privacy: Org C (Insurance) is read-only, consent-gated, GPS/DID excluded
- Duplicate/double-close prevention on all write functions
- **35/35 unit tests pass**

### 3. Fabric SDK Bridge (`lib/fabric.ts`)
- gRPC connections via `@hyperledger/fabric-gateway` with auto-cleanup
- 13 helper functions (one per chaincode operation)
- Org-aware routing (correct peer per function)

### 4. BullMQ Worker (`workers/fabricWorker.ts`)
- 8 job types with Postgres writeback and Redis pub/sub notifications
- Exponential retry backoff (2s → 4s → 8s, max 3 attempts)
- Failed jobs logged to `worker_errors` table
- `addFabricJob()` — Team B's single blockchain interface

### 5. Next.js Backend API (`app/api/`)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | — | Register tourist (email, password, fullName) |
| POST | `/api/auth/login` | — | Login → JWT token |
| GET | `/api/auth/me` | JWT | Get profile (excludes password_hash) |
| POST | `/api/tourist/set-pin` | JWT | Set 4-digit SOS PIN |
| POST | `/api/tourist/register-push` | JWT | Register push notification token |

### 6. PostgreSQL Schema (`db/init.sql`)
8 tables: `tourists`, `tourist_locations`, `geofence_zones`, `sos_events`,
`breach_events`, `kyc_submissions`, `dispatch_events`, `service_accounts`, `worker_errors`

Geofence boundaries stored as GeoJSON in JSONB columns.

### 7. Docker Environment
| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL 15 | tourist-postgres | 5432 |
| Redis 7 | safety-redis | 6379 |
| Adminer | tourist-adminer | 8080 |

## Seed Credentials (dev only)
| Email | Password | Role |
|-------|----------|------|
| admin@safetourism.gov | Admin@123 | admin |
| tourist1@test.com | Tourist@123 | tourist (KYC verified) |
| tourist2@test.com | Tourist@123 | tourist (KYC pending) |
| claims@safetravel.com | Service@123 | service (insurance) |

## Quick Start
```bash
./scripts/hyperledger.sh              # start blockchain + Redis
npm run dev                            # start Next.js API (port 3000)
npm run worker                         # start BullMQ worker (separate terminal)
./scripts/test-api.sh                  # run API integration tests
```

## Test Suites
| Suite | Command | Result |
|-------|---------|--------|
| Go Chaincode | `cd chaincode/safetychaincode && go test -v ./...` | 35/35 pass |
| API Integration | `./scripts/test-api.sh` | 29/29 pass |
| Fabric Network | `./fabric-network/scripts/testNetwork.sh` | 14/14 pass |
