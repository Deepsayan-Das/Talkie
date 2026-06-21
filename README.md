# Talkie — Production Chat Application

A portfolio-grade microservices chat platform built with modern backend and DevOps practices.

**Stack:** Next.js · Node.js · PostgreSQL · MongoDB · Redis · Socket.IO · Docker · Kubernetes

---

## Quick Start

```bash
# Clone and enter project
git clone <repo-url> && cd chat-app

# Copy env file and fill in values
cp .env.example .env

# Start all infrastructure
docker compose up -d

# Verify all containers healthy
docker compose ps

# Verify databases were created
docker exec -it postgres_c psql -U <POSTGRES_USER> -c "\l"
```

---

## Project Structure

```
/
├── apps/
│   ├── api-gateway/          # Routing, rate limiting, JWT verification
│   ├── auth-service/         # Credentials, tokens, sessions, RBAC
│   ├── user-service/         # Profiles, relationships, preferences
│   ├── chat-service/         # Rooms, messages, real-time delivery
│   ├── file-service/         # Upload, S3 storage, metadata
│   ├── notification-service/ # Email, push, in-app notifications
│   └── web/                  # Next.js frontend
├── packages/
│   ├── shared-types/         # TypeScript interfaces shared across services
│   ├── shared-utils/         # AppError, ApiResponse, validators — NO business logic
│   └── eslint-config/
├── infrastructure/
│   ├── docker/
│   │   ├── postgres/
│   │   │   └── init.sql      # Creates all 4 logical databases on first run
│   │   └── mongo/
│   ├── k8s/                  # Empty until Phase 9
│   └── scripts/
├── .env.example              # Copy this to .env — never commit .env
├── docker-compose.yml        # Core infrastructure
└── README.md
```

---

## Environment Variables

Each service has its own `.env.example`. Copy it to `.env` and fill in real values.
`.env` files are gitignored. `.env.example` files are committed.

**Root `.env.example`** covers shared infrastructure (databases, ports).
**Per-service `.env.example`** covers service-specific config (JWT secrets, etc).

In production: use Kubernetes ConfigMaps for non-sensitive config, Kubernetes Secrets for credentials.

---

## Infrastructure

### Databases

| Database | Engine | Owned By | Purpose |
|---|---|---|---|
| auth_db | PostgreSQL | Auth Service | Credentials, tokens, roles |
| users_db | PostgreSQL | User Service | Profiles, relationships |
| files_db | PostgreSQL | File Service | File metadata |
| notifications_db | PostgreSQL | Notification Service | Notification log |
| (chat) | MongoDB | Chat Service | Messages, rooms |

**Why one PostgreSQL container with multiple databases?**
PostgreSQL supports multiple logical databases inside one instance. Each service connects only to its own database — no cross-service joins, no shared connection pool. One container, zero extra cost, full isolation.

**Why separate databases per service instead of shared?**
Service isolation at the infrastructure level. If the User Service crashes, Auth still works because they have separate databases. Shared databases make services implicitly coupled.

### Redis

One Redis container, separate logical databases (DB index) per service.

| Redis DB | Service | Usage |
|---|---|---|
| DB 0 | Auth Service | Refresh token store, blacklisted tokens |
| DB 1 | User Service | Profile cache, online presence |
| DB 2 | Chat Service | Pub/Sub real-time events, typing indicators |
| DB 3 | Notification Service | Job queue, deduplication |
| DB 4 | API Gateway | Rate limit counters |

**Why separate logical databases and not separate Redis instances?**
Cost. Separate logical DBs provide key isolation at zero cost. In production, services get isolated Redis instances to prevent one service's memory spike from affecting others.

**Why does Redis need a persistent volume?**
Redis stores refresh tokens and blacklisted JWT tokens. If Redis restarts without persistence, a blacklisted token becomes valid again — that is a security vulnerability, not just data loss.

---

## Service Boundaries

### API Gateway
**Owns:** Routing, rate limiting, JWT signature verification, CORS, request logging
**Does not own:** Auth business logic, user data, chat logic
**Critical distinction:** Gateway *verifies* tokens. Auth Service *issues* tokens. These are different concerns.

### Auth Service
**Owns:** Credentials, password hashing, JWT issuance, refresh token rotation, email verification tokens, RBAC role assignment
**Does not own:** User profile data, sending emails (delegates to Notification Service)

### User Service
**Owns:** User profiles, display names, avatars, preferences, contact relationships
**Does not own:** Credentials, tokens, message content

### Chat Service
**Owns:** Chat rooms, messages, timestamps, delivery status, typing indicators, room membership
**Does not own:** File binaries, notification dispatch, user credentials

### File Service
**Owns:** File upload orchestration, S3 storage integration, file metadata (name, size, type, owner, URL)
**Does not own:** Chat logic, notification logic, auth

### Notification Service
**Owns:** When and what to send — email dispatch, push, in-app notification queue
**Does not own:** Message content (receives a payload only), file storage, user credentials

---

## Communication Patterns

| Flow | Pattern | Why |
|---|---|---|
| User sends chat message | WebSocket (Socket.IO) | Sub-100ms delivery required. HTTP too slow for real-time |
| File upload → attach to message | Async Event | Upload must never block chat flow |
| Welcome email | Async Event | Registration must not fail if email provider is down |
| Verification email | Async Event | Same — user record created first, email is a side effect |
| User clicks verification link | Synchronous REST | User is actively waiting for a response |
| Client fetches profile | Synchronous REST via Gateway | Standard request/response |

**Client topology rule:** Clients never talk to individual services directly. All traffic enters through the API Gateway. The gateway verifies the JWT, applies rate limiting, then proxies to the correct service.

---

## Authentication Design

### JWT Strategy
- **Access Token:** 15 minute expiry. Stateless. Verified by API Gateway on every request.
- **Refresh Token:** 7 day expiry. Stored hashed in Redis + PostgreSQL. Rotated on every use.
- **Blacklist:** Invalidated tokens stored in Redis until natural expiry. Checked on every gateway verification.

### Why store token hashes, not raw tokens?
If your database is compromised, raw tokens are immediately usable by an attacker. Store a SHA-256 hash, compare hashes on lookup. The attacker gets useless hashes.

### Password hashing: bcrypt. Token hashing: SHA-256. Why different?

**bcrypt** is designed for passwords — human-chosen, weak, short secrets. It is intentionally slow (200ms per check) to make brute force attacks impractical. bcrypt accepts max 72 bytes.

**SHA-256** is for tokens — machine-generated, cryptographically random, high entropy. These cannot be brute forced regardless of hash speed, so slowness buys nothing. SHA-256 is microseconds per operation, which matters when verifying on every API request.

> Rule: bcrypt for secrets humans choose. SHA-256 for secrets machines generate.

```javascript
import crypto from 'crypto'

// Generate token
const token = crypto.randomBytes(32).toString('hex')

// Hash for storage
const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

// Send raw token to user, store only tokenHash
```

### Email Verification State Machine

User verification is modeled as explicit states — not a boolean flag.

```
PENDING  →  (user clicks valid link)  →  VERIFIED
PENDING  →  (token expires, no click)  →  EXPIRED
PENDING  →  (email service down)  →  still PENDING (retry later)
```

Email delivery state (sent, bounced, queued) is tracked separately in the Notification Service log — never mixed into `verification_status`. Email delivery is an infrastructure event. Verification is a user action. Different things.

### RBAC Roles

| Role | Access |
|---|---|
| UNVERIFIED | Read only — cannot send messages |
| USER | Full chat, file uploads, profile management |
| MODERATOR | Delete messages, manage room membership |
| ADMIN | Full platform access including user management |

**Why VARCHAR for role, not PostgreSQL ENUM?**
ENUMs are painful to migrate in PostgreSQL — adding a new value requires an ALTER TYPE which locks the table. VARCHAR with application-layer validation is easier to evolve.

---

## Database Schema (auth_db)

Tables are created via migrations, not raw SQL. Migrations live in each service under `src/db/migrations/`.

**Why migrations, not init scripts?**
Migrations are versioned, timestamped, and reversible. They let you track exactly when a column was added, roll back a bad change, and apply changes incrementally across environments. Think of it as git for your database schema.

### users_auth
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | Never expose sequential IDs — UUIDs prevent enumeration attacks |
| email | VARCHAR(255) UNIQUE | Indexed — most common lookup column |
| password_hash | VARCHAR(255) | bcrypt, cost factor 12 |
| is_verified | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

**Why UUID and not email as primary key?**
Email changes. If email is your PK, every foreign key across every table breaks when a user updates their email. UUID as PK, email as a unique indexed column. UUID wins universally.

### refresh_tokens
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | → users_auth(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) UNIQUE | SHA-256 hash, never raw token |
| is_revoked | BOOLEAN | Mark revoked on logout — don't delete, keep audit trail |
| issued_at | TIMESTAMP | DEFAULT now() |
| expires_at | TIMESTAMP | NOT NULL |

### verification_tokens
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | → users_auth(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) UNIQUE | SHA-256 hash |
| is_used | BOOLEAN | DEFAULT false — mark used after click, never reusable |
| expires_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT now() |

### user_roles
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK UNIQUE | → users_auth(id) — UNIQUE because one user = one role |
| role | VARCHAR(50) | DEFAULT 'UNVERIFIED' |
| assigned_at | TIMESTAMP | DEFAULT now() |

---

## Layered Architecture (per service)

```
Route → Controller → Service → Repository → Database
```

| Layer | File | Responsibility |
|---|---|---|
| routes/ | auth.routes.ts | Define endpoint, attach middleware |
| controllers/ | auth.controller.ts | Parse request, send response |
| services/ | auth.service.ts | Business logic |
| repositories/ | auth.repository.ts | All database queries live here only |

**All SQL/query builder calls live exclusively in the repository layer.**
A service never touches a database directly. A controller never writes a query. This separation makes testing, debugging, and swapping databases possible without touching business logic.

---

## Debugging Runbook

### PostgreSQL won't start
```bash
docker logs postgres_c
```
Common causes:
- Wrong volume path (PostgreSQL 18+ uses `/var/lib/postgresql` not `/var/lib/postgresql/data`)
- Stale volume from previous initialization with different credentials

### Stale volume / user doesn't exist
```bash
docker compose down
docker volume rm <project>_postgres-data
docker compose up -d
```
PostgreSQL init script only runs on first startup. If a volume already has data, init is skipped entirely. Must wipe volume to reinitialize.

### Verify databases were created
```bash
docker exec -it postgres_c psql -U <POSTGRES_USER> -c "\l"
```
Should show: auth_db, users_db, files_db, notifications_db

### Check env vars reaching a container
```bash
docker exec -it <container> bash -c 'echo $VARIABLE_NAME'
```

### Container hostname vs localhost
Inside Docker bridge network, containers reach each other by **service name**, not localhost.
From desktop tools (TablePlus, Compass), use **localhost** with the exposed port.

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| 0 | ✅ Done | Architecture design, service boundaries, decisions |
| 1 | ✅ Done | Docker Compose — PostgreSQL, MongoDB, Redis |
| 2 | 🔄 Next | Auth Service — JWT, refresh tokens, RBAC |
| 3 | ⏳ | User Service — profiles, relationships |
| 4 | ⏳ | API Gateway — routing, rate limiting, JWT verification |
| 5 | ⏳ | Chat Service — rooms, messages, Socket.IO |
| 6 | ⏳ | File Service — upload, S3, metadata |
| 7 | ⏳ | Notification Service — email, push, in-app |
| 8 | ⏳ | Observability — logging, Prometheus, Grafana |
| 9 | ⏳ | Kubernetes migration |
| 10 | ⏳ | CI/CD — GitHub Actions, registry, deploy |

---

## Interview Reference

**Q: Why microservices over monolith?**
Service isolation — one service crashing doesn't take down the whole application. Independent scaling — Chat Service can scale horizontally without scaling Auth. Independent deployment — fix a bug in File Service without redeploying everything.

**Q: Why not share one database across all services?**
Shared databases create hidden coupling. Services start depending on each other's tables. Schema changes break multiple services. One database going down takes everything with it.

**Q: How do services communicate?**
Three patterns based on use case: synchronous REST for request/response flows, WebSocket for real-time, async events (Redis Pub/Sub) for side effects that shouldn't block the main flow.

**Q: Why hash tokens at all if the DB is secure?**
Defence in depth. No system is unconditionally secure. If an attacker gains read access to your database, hashed tokens are useless to them. Raw tokens would let them impersonate any logged-in user.

**Q: What's a migration and why not use init scripts?**
A migration is a versioned, reversible database change. Init scripts run once at container startup and are never tracked. Migrations give you a history of every schema change, the ability to roll back, and a reliable way to apply changes across dev/staging/production consistently.


## Resetting Local Database
If PostgreSQL fails to initialize or user errors occur:
    docker compose down
    docker volume rm <project>_postgres-data
    docker compose up -d

### Port 5432 conflict on Windows
If you have PostgreSQL installed natively on Windows, it competes 
with the Docker container for port 5432. Node connects to the 
wrong instance and gets auth errors even though credentials are correct.

Diagnose:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5432).OwningProcess

Fix:
  Stop-Process -Id <native_postgres_pid> -Force
  docker restart postgres_c