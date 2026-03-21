# Admin System — Tourist Safety System

## Overview

Admins are stored in a **dedicated `admins` table**, separate from tourist and service accounts. This separation ensures:
- Admin credentials cannot be mistakenly exposed through tourist-facing endpoints
- Admin-specific fields (permissions, admin_role, username) are cleanly modelled
- Role escalation from tourist → admin is structurally impossible

---

## Database Table: `admins`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | TEXT | Unique login email |
| `password_hash` | TEXT | bcrypt hash (10 rounds) |
| `full_name` | TEXT | Display name (default: `no_name_available`) |
| `username` | TEXT | Unique handle for internal references |
| `admin_role` | TEXT | `admin` or `super_admin` |
| `permissions` | JSONB | Array of capability strings |
| `active` | BOOLEAN | Deactivated accounts cannot log in |
| `last_login_at` | TIMESTAMPTZ | Auto-updated on each successful login |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last modification time |

### Permission Strings

| Permission | Description |
|---|---|
| `manage_tourists` | View, search, and manage tourist accounts |
| `review_kyc` | Approve or reject KYC submissions |
| `dispatch_responders` | Assign responders to SOS incidents |
| `manage_zones` | Create, update, delete geofence zones |
| `view_analytics` | Access aggregate statistics and reports |
| `manage_admins` | Create and deactivate admin accounts |
| `resolve_incidents` | Close SOS events with an outcome |

---

## Seed Accounts (Development Only)

| Email | Password | Role | Permissions |
|---|---|---|---|
| `admin@safetourism.gov` | `Admin@123` | `super_admin` | All permissions |
| `ops@safetourism.gov` | `Admin@123` | `admin` | dispatch, analytics, kyc, resolve |

> **Important:** Change all seed passwords before deploying to production.

---

## Authentication Flow

### Admin Login Endpoint

```
POST /api/auth/admin/login
Content-Type: application/json

{ "email": "admin@safetourism.gov", "password": "Admin@123" }
```

**Response:**
```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "admin@safetourism.gov",
    "fullName": "System Administrator",
    "username": "sysadmin",
    "role": "admin",
    "adminRole": "super_admin",
    "permissions": ["manage_tourists", "review_kyc", ...],
    "lastLoginAt": "2026-03-21T10:00:00Z",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

### JWT Payload (Admin)

Admin JWTs include these additional fields beyond the standard payload:

```json
{
  "id": "uuid",
  "email": "admin@safetourism.gov",
  "fullName": "System Administrator",
  "role": "admin",
  "username": "sysadmin",
  "adminRole": "super_admin",
  "permissions": ["manage_tourists", "review_kyc", ...]
}
```

### Differences from Tourist Login

| Aspect | Tourist (`/api/auth/login`) | Admin (`/api/auth/admin/login`) |
|---|---|---|
| Table | `tourists` | `admins` |
| Has `did` | Yes | No |
| Has `kycStatus` | Yes | No |
| Has `permissions` | No | Yes |
| Has `username` | No | Yes |
| Checks `active` flag | No | Yes |
| Updates `last_login_at` | No | Yes |

---

## Admin Profile Endpoint

```
GET /api/auth/me
Authorization: Bearer <admin-jwt>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "admin@safetourism.gov",
  "fullName": "System Administrator",
  "username": "sysadmin",
  "role": "admin",
  "adminRole": "super_admin",
  "permissions": ["manage_tourists", ...],
  "active": true,
  "lastLoginAt": "2026-03-21T10:00:00Z",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-03-21T10:00:00Z"
}
```

The `/api/auth/me` endpoint detects admin tokens via `role === 'admin'` and queries the `admins` table instead of `tourists`.

---

## Adding a New Admin

Connect to the database and insert directly:

```sql
INSERT INTO admins (email, password_hash, full_name, username, admin_role, permissions)
VALUES (
  'newadmin@safetourism.gov',
  crypt('YourSecurePassword', gen_salt('bf', 10)),
  'New Admin Name',
  'newadmin',
  'admin',
  '["dispatch_responders","view_analytics"]'::jsonb
);
```

Or use the Adminer web UI at `http://localhost:8080`:
- Server: `tourist-postgres`
- Username: `postgres`
- Password: `postgres`
- Database: `tourist_safety`

---

## Deactivating an Admin

```sql
UPDATE admins SET active = false, updated_at = NOW()
WHERE email = 'admin@example.com';
```

Deactivated accounts receive `401 Admin account is deactivated` on login attempts.

---

## Startup Scripts

### Start everything

```bash
# 1. Start blockchain (Hyperledger Fabric + Redis)
./scripts/hyperledger.sh

# 2. Start backend (PostgreSQL + Adminer + Next.js server)
./scripts/backend.sh

# 3. (Optional) Start just the Next.js dev server with hot-reload
./scripts/startNext.sh
```

### Script reference

| Script | Purpose | Options |
|---|---|---|
| `scripts/hyperledger.sh` | Blockchain stack (Fabric + Redis + BullMQ worker) | `--no-worker`, `--status`, `--stop` |
| `scripts/backend.sh` | Backend services (PostgreSQL + Redis + Next.js server) | `--db-only`, `--status`, `--stop` |
| `scripts/startNext.sh` | Next.js dev server with hot-reload | `--prod`, `--port <n>`, `--skip-checks` |

### Typical development workflow

```bash
# Terminal 1 — blockchain
./scripts/hyperledger.sh

# Terminal 2 — database only
./scripts/backend.sh --db-only

# Terminal 3 — Next.js with hot-reload
./scripts/startNext.sh
```

### Full server (production-like)

```bash
./scripts/hyperledger.sh
./scripts/backend.sh        # starts Next.js via tsx server.ts (includes Socket.IO)
```

---

## Architecture Notes

- Admin login is at `/api/auth/admin/login` — the admin portal login page calls this endpoint directly
- Tourist login remains at `/api/auth/login` — mobile app and services portal use this
- Service accounts (insurance, tourism board) authenticate via `/api/auth/login` against the `service_accounts` table (handled in the login route via role check)
- `requireRole(req, 'admin')` in API routes works identically for admins from either source — it reads the `role` claim from the JWT
