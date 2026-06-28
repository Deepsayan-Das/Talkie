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

# Start auth service (dev)
cd apps/auth-service && npm run dev

# Run auth service tests
cd apps/auth-service && npm test
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
**Per-service `.env.example`** covers service-specific config (JWT secrets, Redis DB index, etc).

In production: use Kubernetes ConfigMaps for non-sensitive config, Kubernetes Secrets for credentials.

### API Gateway `.env.example`
```bash
PORT=3000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your_jwt_secret
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
CHAT_SERVICE_URL=http://localhost:3003
FILE_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005
```

### Auth Service `.env.example`
```bash
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=auth_db
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
BCRYPT_ROUNDS=12
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
SMTP_FROM=noreply@talkie.dev
```

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
| DB 0 | Auth Service | Blacklisted tokens, refresh token metadata |
| DB 1 | User Service | Profile cache, online presence |
| DB 2 | Chat Service | Pub/Sub real-time events, typing indicators |
| DB 3 | Notification Service | Job queue, deduplication |
| DB 4 | API Gateway | Rate limit counters |

**Why separate logical databases and not separate Redis instances?**
Cost. Separate logical DBs provide key isolation at zero cost. In production, services get isolated Redis instances to prevent one service's memory spike from affecting others.

**Why does Redis need a persistent volume?**
Redis stores blacklisted JWT tokens. If Redis restarts without persistence, a blacklisted token becomes valid again — that is a security vulnerability, not just data loss.

---

## Service Boundaries

### API Gateway
**Owns:** Routing, rate limiting, JWT signature verification, CORS, request logging
**Does not own:** Auth business logic, user data, chat logic
**Critical distinction:** Gateway *verifies* tokens. Auth Service *issues* tokens. These are different concerns.

#### Middleware Pipeline (applied in order)
```
Incoming request
  → CORS check          (origin allowlist, preflight handling)
  → Request logger      (method, path, status, latency)
  → Global rate limiter (1000 req / 10 min per IP — all routes)
  → Auth rate limiter   (20 req / 15 min per IP — /auth/* only)
  → JWT verification    (protected routes only — extracts id, injects X-User-Id header)
  → http-proxy-middleware (forward to target service, 502 on service error)
```

#### Route Config (`config/routes.ts`)
| Prefix | Target | Protected | Rate Limited (auth) |
|---|---|---|---|
| /auth/register | AUTH_SERVICE_URL | ❌ | ✅ |
| /auth/login | AUTH_SERVICE_URL | ❌ | ✅ |
| /auth/verify/:token | AUTH_SERVICE_URL | ❌ | ✅ |
| /auth | AUTH_SERVICE_URL | ✅ | ✅ |
| /user | USER_SERVICE_URL | ✅ | ❌ |
| /chat | CHAT_SERVICE_URL | ✅ | ❌ |
| /file | FILE_SERVICE_URL | ✅ | ❌ |
| /notification | NOTIFICATION_SERVICE_URL | ✅ | ❌ |

**Partial auth routes:** Express matches routes in registration order. Specific prefixes (`/auth/register`, `/auth/login`, `/auth/verify/:token`) are registered before the catch-all `/auth` prefix — more specific routes win, so public endpoints bypass JWT verification while all other auth routes remain protected.

#### CORS
Custom middleware (not the `cors` npm package). Reads `CORS_ORIGIN` from env, checks incoming `Origin` header against an allowlist, sets `Access-Control-Allow-*` headers, handles preflight `OPTIONS` with a `200` short-circuit.

#### JWT Verification (`middleware/jwtVerify.middleware.ts`)
Extracts Bearer token from `Authorization` header → `jwt.verify()` against `JWT_SECRET` → attaches decoded payload to `req.user` → injects `X-User-Id` header for downstream services. Returns `401` for missing or invalid tokens.

#### Proxy (`proxy.ts`)
`http-proxy-middleware` with `changeOrigin: true`. On upstream error: `502 Service unavailable`. No path rewriting — prefixes are preserved as-is into the target service.

### Auth Service
**Owns:** Credentials, password hashing, JWT issuance, refresh token rotation, email verification tokens, RBAC role assignment
**Does not own:** User profile data, sending emails (delegates to Notification Service)

### User Service
**Owns:** User profiles, display names, avatars, preferences, contact relationships
**Does not own:** Credentials, tokens, message content

### Chat Service
**Owns:** Chat rooms, messages, timestamps, delivery status, typing indicators, room membership
**Does not own:** File binaries, notification dispatch, user credentials

**Real-time architecture:**
Socket.IO runs on the same HTTP server as REST. JWT is verified at connection time via socket.handshake.auth.token — not per-event. Once connected, socket.data.userId is trusted for the lifetime of the connection.

### File Service
**Owns:** File upload orchestration, MinIO/S3 storage, file metadata, presigned URL generation
**Does not own:** Chat logic, notification logic, user credentials

**Why presigned URLs?**
Files are private in MinIO. Instead of making objects publicly accessible, the File Service generates short-lived signed URLs (default 1 hour) that give the client temporary direct access. This is the production-standard pattern used by Slack, Notion, and Discord.

**Why MinIO locally?**
MinIO is S3-compatible — the same AWS SDK code works against MinIO in dev and real AWS S3 in production. Switching requires only three env variable changes: endpoint, access key, secret key.
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

## Authentication vs Authorization

**Authentication** = identifying who this user is.
- Happens in the **Auth Service** — login, registration, token issuance, verification.
- Answers: "Are you who you claim to be?"

**Authorization** = determining what this user can and cannot do.
- Happens in the **API Gateway** — checks the JWT `role` claim on every request.
- Answers: "Are you allowed to do what you're trying to do?"

These are always separate concerns. Never mix them.

---

## Authentication Design

### JWT Strategy
- **Access Token:** 15 minute expiry. Stateless. Verified by API Gateway on every request. Returned in response body — stored in memory by frontend.
- **Refresh Token:** 7 day expiry. Stored hashed in PostgreSQL. Sent/received as httpOnly cookie — JavaScript cannot access it.
- **Blacklist:** Invalidated access tokens stored in Redis with TTL matching token expiry. Automatically cleaned up by Redis. Checked on every gateway verification.

### Token Security Rules
- Never store raw tokens — always store SHA-256 hash
- Access token → response body (frontend stores in memory, not localStorage)
- Refresh token → httpOnly cookie (immune to XSS attacks)
- Blacklist uses token hash as Redis key to save memory

### Why httpOnly cookie for refresh token?
```
localStorage/body → accessible via JavaScript → XSS attack can steal it
httpOnly cookie   → not accessible via JavaScript → XSS cannot touch it
```

### Why store token hashes, not raw tokens?
If your database is compromised, raw tokens are immediately usable by an attacker.
Store a SHA-256 hash, compare hashes on lookup. The attacker gets useless hashes.

### Password hashing: bcrypt. Token hashing: SHA-256. Why different?

**bcrypt** is designed for passwords — human-chosen, weak, short secrets. Intentionally slow (200ms per check) to make brute force impractical. Max 72 bytes input.

**SHA-256** is for tokens — machine-generated, cryptographically random, high entropy. Cannot be brute forced regardless of speed. Microseconds per operation — critical when verifying on every API request.

> Rule: bcrypt for secrets humans choose. SHA-256 for secrets machines generate.

### Refresh Token Rotation
Every time a refresh token is used, it is immediately invalidated and a new one is issued.

```
Client uses refresh token → old token deleted → new token issued
Attacker tries stolen token after rotation → token gone → attack blocked
```

Without rotation, a stolen refresh token is valid for its entire 7-day lifetime.

### Email Verification State Machine

```
PENDING  →  (user clicks valid link before expiry)  →  role upgraded to USER, tokens issued
PENDING  →  (token expires, link never clicked)      →  EXPIRED, must request new email
PENDING  →  (email service down)                     →  still PENDING, retry later
```

Email delivery state (sent, bounced, queued) is tracked in Notification Service log — never mixed into user verification status. Email delivery is infrastructure. Verification is a user action. Different things.

### Session Strategy by Role

| Role | Access Token | Refresh Token | Why |
|---|---|---|---|
| UNVERIFIED | ✅ Issued on register | ❌ Not issued | Tab closes = logged out. Encourages verification. |
| USER | ✅ Issued on login | ✅ Issued on login | Full persistent session |
| MODERATOR | ✅ | ✅ | Same as USER |
| ADMIN | ✅ | ✅ | Same as USER |

### RBAC Roles

| Role | Access |
|---|---|
| UNVERIFIED | Can request verification email resend. Cannot send messages. |
| USER | Full chat, file uploads, profile management |
| MODERATOR | Delete messages, manage room membership |
| ADMIN | Full platform access including user management |

**Why VARCHAR for role, not PostgreSQL ENUM?**
ENUMs are painful to migrate in PostgreSQL — adding a new value requires ALTER TYPE which locks the table. VARCHAR with application-layer validation is easier to evolve.

---

## Auth Service — API Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | /auth/register | None | Create account, send verification email |
| POST | /auth/login | None | Verify credentials, issue tokens |
| GET | /auth/verify/:token | None | Verify email, upgrade role to USER |
| POST | /auth/resend-verification | Access token | Resend verification email |
| POST | /auth/refresh | Refresh token cookie | Rotate tokens |
| POST | /auth/logout | Access token | Blacklist token, clear session |

## User Service — API Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | /users/search?q= | X-User-Id | Search users by username |
| GET | /users/buddies | X-User-Id | Get all relationships for current user |
| GET | /users/:id | X-User-Id | View user profile |
| PATCH | /users/:id | X-User-Id | Edit own profile only |
| POST | /users/:id/buddy-request | X-User-Id | Send buddy request |
| PATCH | /users/:id/buddy-request/accept | X-User-Id | Accept incoming request |
| PATCH | /users/:id/buddy-request/reject | X-User-Id | Reject incoming request |
| POST | /users/:id/block | X-User-Id | Block a user (upsert) |
| DELETE | /users/:id/block | X-User-Id | Unblock a user (deletes relationship row) |

**X-User-Id internal trust pattern:**
The API Gateway verifies the JWT and forwards the decoded user identity as X-User-Id header. Internal services trust this header — they never re-validate the JWT. This is the standard internal service trust pattern.

---

## Chat Service — REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /chat/room | Create room or return existing DM |
| GET | /chat/room | Get all rooms for current user |
| GET | /chat/room/:roomId | Get room details |
| PATCH | /chat/room/:roomId | Update group (admin only) |
| DELETE | /chat/room/:roomId | Delete group (owner only) |
| POST | /chat/room/:roomId/member | Add member (admin only) |
| DELETE | /chat/room/:roomId/member | Remove member (admin or self) |
| PATCH | /chat/room/:roomId/member/:memberId/promote | Promote to admin |
| PATCH | /chat/room/:roomId/member/:memberId/demote | Demote to member |
| GET | /chat/room/:roomId/messages | Fetch paginated message history |

## Chat Service — Socket Events

| Direction | Event | Payload | Description |
|---|---|---|---|
| client → server | joinRoom | roomId | Join a room channel |
| client → server | leaveRoom | roomId | Leave a room channel |
| client → server | sendMessage | { roomId, content, attachments? } | Send a message |
| client → server | editMessage | { roomId, messageId, content } | Edit own message |
| client → server | deleteMessage | { roomId, messageId } | Soft delete own message |
| client → server | markAsSeen | { roomId, messageId } | Mark message as seen |
| client → server | typing | { roomId } | Broadcast typing indicator |
| client → server | stopTyping | { roomId } | Broadcast stop typing |
| server → client | newMessage | message object | New message in room |
| server → client | messageEdited | updated message | Message was edited |
| server → client | messageDeleted | { messageId } | Message was soft deleted |
| server → client | messageSeen | { messageId, userId, seenAt } | Read receipt update |
| server → client | userTyping | { userId } | Someone is typing |
| server → client | userStoppedTyping | { userId } | Someone stopped typing |

## Database Schema (auth_db)

Tables are created via Knex migrations — not raw SQL. Migrations live in each service under `src/db/migrations/`.

**Why migrations, not init scripts?**
Migrations are versioned, timestamped, and reversible. Track exactly when a column was added, roll back a bad change, apply changes incrementally across environments. Git for your database schema.

### users_auth
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | UUIDs prevent enumeration attacks vs sequential IDs |
| email | VARCHAR(255) UNIQUE | Indexed — most common lookup column |
| password_hash | VARCHAR(255) | bcrypt cost factor 12 |
| is_verified | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

**Why UUID not email as PK?** Email changes. Every FK breaks on update. UUID is immutable.

### refresh_tokens
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | → users_auth(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) UNIQUE | SHA-256 hash — never raw token |
| is_revoked | BOOLEAN | Mark revoked, don't delete — preserves audit trail |
| issued_at | TIMESTAMP | DEFAULT now() |
| expires_at | TIMESTAMP | NOT NULL |

### verification_tokens
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | → users_auth(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) UNIQUE | SHA-256 hash |
| is_used | BOOLEAN | DEFAULT false — one-time use enforced |
| expires_at | TIMESTAMP | NOT NULL — 24 hour window |
| created_at | TIMESTAMP | DEFAULT now() |

### user_roles
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK UNIQUE | → users_auth(id) — UNIQUE = one user, one role |
| role | VARCHAR(50) | DEFAULT 'UNVERIFIED' |
| assigned_at | TIMESTAMP | DEFAULT now() |

## Database Schema (users_db)

### users_profile
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID | References auth_db users_auth(id) — no FK, cross-service boundary |
| username | VARCHAR(50) UNIQUE | Indexed |
| avatar_url | VARCHAR(500) | Nullable |
| last_seen | TIMESTAMP | Nullable |
| bio | VARCHAR(300) | Nullable |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

**Why no foreign key to auth_db?**
Foreign keys cannot cross database boundaries in PostgreSQL. The application layer enforces this relationship — User Service trusts that user_id was issued by Auth Service via the X-User-Id header forwarded by the Gateway.

### relationships
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| requester_id | UUID | Smaller UUID of the pair — canonical ordering enforced |
| receiver_id | UUID | Larger UUID of the pair |
| status | VARCHAR(20) | pending / accepted / rejected / blocked |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

**Canonical ordering pattern:**
A relationship between users A and B is always stored with the smaller UUID as requester_id. This means (A→B) and (B→A) map to the same row, enforced by a CHECK constraint. All queries sort IDs before lookup:
```typescript
const [first, second] = [userId, targetId].sort();
```
This prevents duplicate rows and makes bidirectional lookups O(1).

**Why not a follow model?**
Talkie is a chat app. A one-sided connection makes no sense — you cannot have a conversation with someone who didn't agree to it. Bidirectional friendship with explicit accept/reject is the correct model.

## Database Schema (files_db)

### files
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| owner_id | UUID | References auth_db users_auth(id) — no FK, cross-service boundary |
| original_name | VARCHAR(255) | Original filename from client |
| mime_type | VARCHAR(255) | e.g. image/jpeg, application/pdf |
| size | INTEGER | File size in bytes |
| storage_key | VARCHAR | Path in MinIO bucket e.g. uploads/{ownerId}/{timestamp}-{name} |
| url | VARCHAR | Direct MinIO URL |
| created_at | TIMESTAMP | DEFAULT now() |
| updated_at | TIMESTAMP | DEFAULT now() |

---

## Layered Architecture (per service)

```
Route → Controller → Service → Repository → Database
```

| Layer | Responsibility |
|---|---|
| routes/ | Define endpoint, attach middleware |
| controllers/ | Parse request, send response, handle HTTP status codes |
| services/ | Business logic — hashing, token generation, validation rules |
| repositories/ | All database queries — nothing else |

**All SQL/query builder calls live exclusively in the repository layer.**
A service never touches a database directly. A controller never writes a query.
This separation makes unit testing possible — mock the repository, test the service logic in isolation.

---

## Testing Strategy

```
Controller  → Integration tests via supertest (simulate HTTP, mock service layer)
Service     → Unit tests (mock repository layer, test business logic only)
Repository  → Skipped in unit tests (would require live database)
```

**Why mock in tests?**
Mocks replace real functions with fakes that return controlled values. Tests run without Docker, without a database, without a server. Fast, isolated, reliable. Runs in CI with zero infrastructure.

```bash
# Run all tests
npm test

# Tests use NODE_ENV=test to suppress console.error noise
```

**Key Jest concepts:**
- `jest.mock()` — replace real module with fake
- `mockResolvedValue()` — fake async function returning a value
- `mockRejectedValue()` — fake async function that throws
- `beforeEach(jest.clearAllMocks)` — prevent mock state bleeding between tests
- `supertest request(app)` — simulate HTTP without starting a real server

---

## Debugging Runbook

### PostgreSQL won't start
```bash
docker logs postgres_c
```
Common causes:
- Wrong volume path (PostgreSQL 18+ uses `/var/lib/postgresql` not `/var/lib/postgresql/data`)
- Stale volume from previous init with different credentials

### Stale volume / user doesn't exist
```bash
docker compose down
docker volume rm <project>_postgres-data
docker compose up -d
```
PostgreSQL init script only runs on first startup. Volume has data = init skipped. Must wipe to reinitialize.

### Port 5432 conflict on Windows
Native PostgreSQL installation competes with Docker container for port 5432.
Node connects to wrong instance — auth errors even though credentials are correct.

```powershell
# Diagnose
Get-Process -Id (Get-NetTCPConnection -LocalPort 5432).OwningProcess

# Fix
Stop-Process -Id <native_postgres_pid> -Force
docker restart postgres_c
```

### Verify databases were created
```bash
docker exec -it postgres_c psql -U <POSTGRES_USER> -c "\l"
# Should show: auth_db, users_db, files_db, notifications_db
```

### Check env vars reaching a container
```bash
docker exec -it <container> bash -c 'echo $VARIABLE_NAME'
```

### Container hostname vs localhost
- Inside Docker network → containers use **service name** (e.g. `postgres`, `redis`)
- From host machine (desktop tools, Node running locally) → use **localhost** with exposed port

### Redis connection from host
```bash
# Auth service running locally connects to Redis via:
REDIS_HOST=localhost
REDIS_PORT=6379
# NOT redis:6379 — that only works container-to-container
```

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| 0 | ✅ Done | Architecture design, service boundaries, decisions |
| 1 | ✅ Done | Docker Compose — PostgreSQL, MongoDB, Redis |
| 2 | ✅ Done | Auth Service — JWT, refresh tokens, RBAC, email verification, tests |
| 3 | ✅ Done | User Service — profiles, relationships, buddy request lifecycle |
| 4 | ✅ Done | API Gateway — routing, JWT verification, rate limiting, CORS |
| 5 | ✅ Done | Chat Service — rooms, messages, Socket.IO real-time |
| 6 | ✅ Done | File Service — upload, S3 storage, metadata, presigned URLs |
| 7 | ⏳ | Notification Service — email, push, in-app |
| 8 | ⏳ | Observability — logging, Prometheus, Grafana |
| 9 | ⏳ | Kubernetes migration |
| 10 | ⏳ | CI/CD — GitHub Actions, registry, deploy |

---

## Interview Reference

**Q: What's the difference between authentication and authorization?**
Authentication identifies who you are — handled by the Auth Service (login, tokens, verification).
Authorization determines what you can do — handled by the API Gateway (checks JWT role claim on every request). Always separate concerns, never mixed.

**Q: Why microservices over monolith?**
Service isolation — one service crashing doesn't take down the application. Independent scaling — Chat Service scales without scaling Auth. Independent deployment — fix File Service without redeploying everything.

**Q: Why not share one database across all services?**
Shared databases create hidden coupling. Services depend on each other's tables. Schema changes break multiple services. One database outage takes everything down.

**Q: How do services communicate?**
Three patterns: synchronous REST for request/response, WebSocket for real-time, async events (Redis Pub/Sub) for side effects that shouldn't block the main flow.

**Q: Why hash tokens stored in the database?**
Defence in depth. If an attacker reads the database, hashed tokens are useless — they cannot be used to impersonate users. Raw tokens would give immediate access to every active session.

**Q: Why bcrypt for passwords but SHA-256 for tokens?**
bcrypt is slow by design — makes brute force of human-chosen passwords impractical. Tokens are machine-generated with high entropy — cannot be brute forced regardless of hash speed. SHA-256 is microseconds vs bcrypt's 200ms, which matters on every API request.

**Q: What is refresh token rotation?**
Every use of a refresh token invalidates it and issues a new one. If an attacker steals a token, it becomes useless the moment the legitimate user makes any request. Without rotation, a stolen token is valid for its entire 7-day lifetime.

**Q: Why httpOnly cookie for refresh token?**
httpOnly cookies cannot be accessed by JavaScript. XSS attacks that steal localStorage or JS-accessible cookies cannot touch httpOnly cookies. Access tokens live in memory (short-lived anyway). Refresh tokens live in httpOnly cookies (long-lived, must be protected).

**Q: What's a migration and why not init scripts?**
A migration is a versioned, reversible database change. Init scripts run once and are never tracked. Migrations give history of every schema change, ability to roll back, and reliable incremental application across environments.

**Q: How do you test microservices without running the full stack?**
Unit tests mock the repository layer — service logic is tested with fake database functions. Integration tests use supertest to simulate HTTP requests against an in-memory Express app with the service layer mocked. Zero Docker, zero database, zero running server required.

**Q: How do you handle bidirectional relationships in a single database row?**
Canonical ordering — always store the smaller UUID as requester_id. A CHECK constraint enforces this at the database level. All application queries sort IDs before lookup. This prevents duplicate rows for the same pair regardless of who initiated the relationship.

**Q: How do you prevent duplicate friend requests?**
The relationships table has a unique constraint on (requester_id, receiver_id) combined with canonical ordering. At the service layer, we check existing relationship status before inserting — blocked returns 403, pending returns 429, accepted returns 409. Rejected requests have a 24-hour cooldown tracked via updated_at.

**Q: Why does unblock delete the relationship row instead of updating status?**
After unblocking, there is no natural state to revert to. The relationship history is gone. Deleting the row lets both users start fresh — either can send a new buddy request as if they never connected.

**Q: How do internal services identify the calling user?**
The API Gateway extracts and verifies the JWT, then forwards the user identity as an X-User-Id header. Internal services read this header and trust it — they never touch the JWT directly. This keeps auth logic centralized in the Gateway.

**Q: How does the API Gateway handle partial auth routes?**
Specific prefixes (`/auth/register`, `/auth/login`, `/auth/verify/:token`) are registered as unprotected routes before the catch-all `/auth` prefix. Express matches routes in registration order — more specific routes win. This means public auth endpoints bypass JWT verification while every other `/auth/*` route (e.g. `/auth/logout`, `/auth/refresh`) requires a valid token.

**Q: Why build a custom API Gateway instead of using Kong or Nginx?**
For a portfolio project, a hand-rolled gateway demonstrates understanding of the underlying concerns — middleware ordering, JWT verification, rate limiting strategy, CORS policy, and proxy behaviour. Production systems would use a managed gateway (Kong, AWS API Gateway, or Nginx) for observability, plugin ecosystems, and operational simplicity.

**Q: How does Socket.IO authentication work?**
JWT is verified once at connection time via the handshake auth object. The decoded user identity is attached to socket.data.userId and trusted for the lifetime of the connection. Per-event auth would be redundant and expensive.

**Q: Why use Socket.IO over raw WebSockets?**
Socket.IO adds rooms, namespaces, automatic reconnection, and fallback to long-polling when WebSocket isn't available. Raw WebSockets require you to implement all of this yourself.

**Q: How do you prevent users from editing other people's messages?**
The service layer fetches the message before updating and checks senderId === userId. If they don't match, it throws a 403 equivalent error before touching the database.

**Q: What is the singleton DM room pattern?**
Before creating a DM room, the repository checks if a room already exists with exactly those two members and kind=dm. If it does, it returns the existing room. This prevents duplicate conversations between the same two users.
**Q: Why not store files in PostgreSQL or on disk?**
PostgreSQL BLOBs are slow and bloat the database. Server disk is ephemeral in Kubernetes — pods restart and lose local files. Object storage like S3/MinIO is designed for binary data, scales independently, and survives pod restarts.

**Q: What is a presigned URL?**
A time-limited signed URL generated by the server that gives the client temporary direct access to a private S3 object. The client fetches the file directly from MinIO/S3 — the file never passes through your service. Reduces server load and latency.

**Q: How do you switch from MinIO to AWS S3 in production?**
Change three env variables — MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY. The AWS SDK code is identical. This is the S3-compatible storage pattern.

**Q: Why use multer memoryStorage instead of diskStorage?**
diskStorage writes to the server's local filesystem first. In Kubernetes, that disk is ephemeral and not shared across pods. memoryStorage keeps the file in RAM as a Buffer, which is then immediately streamed to MinIO. No local disk dependency.