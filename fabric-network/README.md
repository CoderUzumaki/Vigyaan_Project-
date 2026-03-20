# Hyperledger Fabric Network — Tourist Safety System

A complete Hyperledger Fabric 2.5 network for the Tourist Safety System with **3 organisations**, **CouchDB** state databases, and **RAFT** consensus.

## Organisation Mapping

| MSP ID   | System Role         | Peer Address                    | Peer Port | CouchDB Port | CA Port |
|----------|---------------------|---------------------------------|-----------|--------------|---------|
| Org1MSP  | TourismAuthority    | peer0.org1.example.com          | 7051      | 5984         | 7054    |
| Org2MSP  | EmergencyServices   | peer0.org2.example.com          | 9051      | 7984         | 8054    |
| Org3MSP  | Insurance           | peer0.org3.example.com          | 11051     | 9984         | 11054   |

## Prerequisites

| Dependency      | Minimum Version | Check Command          |
|-----------------|-----------------|------------------------|
| Go              | 1.21            | `go version`           |
| Docker          | 24.0+           | `docker --version`     |
| Docker Compose  | 2.0+            | `docker compose version` |
| jq              | 1.6+            | `jq --version`         |
| curl            | any             | `curl --version`       |

Install on Ubuntu/Debian:

```bash
# Docker
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin jq
sudo usermod -aG docker $USER

# Go 1.21
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

## Quick Start

### 1. Clone fabric-samples (one-time setup)

```bash
# Clone into the same parent directory as this project
cd ..
git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7
```

Expected directory layout:

```
parent-directory/
├── Vigyaan_Project-/
│   └── fabric-network/    ← you are here
└── fabric-samples/
    ├── bin/               ← peer, orderer, etc. binaries
    ├── config/
    └── test-network/
```

### 2. Start the Network

```bash
cd fabric-network
./scripts/startNetwork.sh
```

This will:
1. Tear down any existing Fabric network
2. Start Org1 + Org2 with CouchDB on `safetychannel`
3. Add Org3 (Insurance) to the channel
4. Extract TLS certificates into connection profiles
5. Print a status summary

### 3. Deploy Chaincode

```bash
./scripts/deployChaincode.sh
```

This runs the full Fabric lifecycle:
1. Vendor Go dependencies
2. Package chaincode
3. Install on all 3 peers
4. Approve for all 3 orgs
5. Commit to the channel

**Upgrade chaincode** by incrementing version and sequence:

```bash
CHAINCODE_VERSION=2.0 CHAINCODE_SEQUENCE=2 ./scripts/deployChaincode.sh
```

### 4. Run Smoke Tests

```bash
./scripts/testNetwork.sh
```

Checks:
- ✓ All peer containers running
- ✓ Orderer running
- ✓ CouchDB instances reachable
- ✓ Channel membership
- ✓ Chaincode committed & callable
- ✓ Connection profiles valid

## Scripts Reference

| Script                   | Purpose                                     |
|--------------------------|---------------------------------------------|
| `scripts/startNetwork.sh`    | Full network startup (2 orgs → add Org3)   |
| `scripts/extractCerts.sh`    | Populate connection profiles with real certs|
| `scripts/deployChaincode.sh` | Full chaincode lifecycle deployment         |
| `scripts/testNetwork.sh`     | Network smoke tests                         |

## Connection Profiles

Located in `connection-profiles/`. Used by the **fabric-gateway Node.js SDK** to connect to peers.

| File        | Organisation        | Peer Port | Description            |
|-------------|---------------------|-----------|------------------------|
| `org1.json` | Org1MSP (Tourism)   | 7051      | TourismAuthority       |
| `org2.json` | Org2MSP (Emergency) | 9051      | EmergencyServices      |
| `org3.json` | Org3MSP (Insurance) | 11051     | Insurance              |

> **Note:** TLS cert paths are placeholder values (`__TLS_CA_CERT__`) until you run `extractCerts.sh` or `startNetwork.sh` (which calls it automatically).

## Environment Variables

| Variable              | Default                             | Description                          |
|-----------------------|-------------------------------------|--------------------------------------|
| `FABRIC_SAMPLES_DIR`  | `../../fabric-samples`              | Path to fabric-samples clone         |
| `CHANNEL_NAME`        | `safetychannel`                     | Fabric channel name                  |
| `CHAINCODE_NAME`      | `safetychaincode`                   | Chaincode package name               |
| `CHAINCODE_SRC_PATH`  | `../../chaincode/safetychaincode`   | Path to Go chaincode source          |
| `CHAINCODE_VERSION`   | `1.0`                               | Chaincode version                    |
| `CHAINCODE_SEQUENCE`  | `1`                                 | Chaincode sequence number            |

## Port Reference

```
Peers:
  7051  ← peer0.org1.example.com (TourismAuthority)
  9051  ← peer0.org2.example.com (EmergencyServices)
  11051 ← peer0.org3.example.com (Insurance)

Orderer:
  7050  ← orderer.example.com (RAFT)

CouchDB:
  5984  ← Org1 CouchDB  → http://localhost:5984/_utils
  7984  ← Org2 CouchDB  → http://localhost:7984/_utils
  9984  ← Org3 CouchDB  → http://localhost:9984/_utils

Certificate Authorities:
  7054  ← ca-org1
  8054  ← ca-org2
  11054 ← ca-org3
```

## Reset Everything

To completely tear down the network and remove all state:

```bash
cd ../fabric-samples/test-network
./network.sh down
```

This removes:
- All Docker containers
- All channel artifacts
- All crypto material (certs, keys)
- All CouchDB data

Then re-run `./scripts/startNetwork.sh` for a fresh start.

## Troubleshooting

### Docker network conflicts

```
Error: could not create network fabric_test
```

**Fix:** Remove stale Docker networks:

```bash
docker network prune
docker volume prune
```

### Port already in use

```
Error: bind: address already in use
```

**Fix:** Find and kill the process using the port:

```bash
sudo lsof -i :7051   # or whichever port
sudo kill -9 <PID>
```

Or tear down the network first: `./network.sh down`

### Cert path issues

```
Error: TLS CA cert not found
```

**Fix:** Ensure the network is running, then re-run cert extraction:

```bash
./scripts/extractCerts.sh
```

### Org3 not joining channel

```
Error: bad proposal response 500
```

**Fix:** Ensure Org3 containers are healthy:

```bash
docker logs peer0.org3.example.com
docker ps --filter "name=org3"
```

If containers aren't running, try:

```bash
cd fabric-samples/test-network/addOrg3
./addOrg3.sh down
./addOrg3.sh up -c safetychannel -s couchdb
```

### peer CLI not found

```
Error: 'peer' CLI not found in PATH
```

**Fix:** Ensure fabric-samples binaries are installed:

```bash
cd fabric-samples
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.7
export PATH=$(pwd)/bin:$PATH
```

### CouchDB authentication

Default credentials for all CouchDB instances:
- **Username:** `admin`
- **Password:** `adminpw`

Access the Fauxton UI at `http://localhost:<port>/_utils`
