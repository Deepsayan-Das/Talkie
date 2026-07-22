# Talkie — Microservices Architecture & System Design Interview Reference

This reference guide contains key technical interview questions, architecture trade-offs, and system design decisions made throughout the development of **Talkie**.

---

## 🔐 Authentication & Authorization

### Q1: What is the difference between authentication and authorization?
**A:**
- **Authentication** identifies *who* the user is. Handled by the **Auth Service** during login, registration, token issuance, and email verification.
- **Authorization** determines *what* the user is allowed to do. Handled by the **API Gateway** by validating JWT claims (such as `role`) on protected routes before proxying requests.
*Rule: Always keep authentication and authorization logic decoupled.*

### Q2: Why microservices over a monolith?
**A:**
- **Fault Isolation**: An uncaught exception or crash in the File Service or Notification Service does not take down core chat delivery or user login.
- **Independent Scalability**: The Chat Service (handling high-volume WebSockets) can scale to 50 container instances independently of the Auth Service.
- **Independent Deployment**: Deploy fixes to the User Service without rebuilding or restarting the Chat Service.

### Q3: Why not share one database across all services?
**A:** Shared databases create hidden coupling. Services depend on each other's tables. Schema changes break multiple services. One database outage takes everything down.

### Q4: How do services communicate?
**A:** Three patterns: synchronous REST for request/response, WebSocket for real-time, async events (RabbitMQ) for side effects that shouldn't block the main flow.

### Q5: Why hash tokens stored in the database?
**A:** Defence in depth. If an attacker reads the database, hashed tokens are useless — they cannot be used to impersonate users. Raw tokens would give immediate access to every active session.

### Q6: Why bcrypt for passwords but SHA-256 for tokens?
**A:** bcrypt is slow by design (~200ms) — makes brute force of human-chosen passwords impractical. Tokens are machine-generated with high entropy — cannot be brute forced regardless of hash speed. SHA-256 is microseconds vs bcrypt's 200ms, which matters on every API request.

### Q7: What is refresh token rotation?
**A:** Every use of a refresh token invalidates it and issues a new one. If an attacker steals a token, it becomes useless the moment the legitimate user makes any request. Without rotation, a stolen token is valid for its entire 7-day lifetime.

### Q8: Why httpOnly cookie for refresh token?
**A:** `httpOnly` cookies cannot be accessed by JavaScript. XSS attacks that steal `localStorage` or JS-accessible cookies cannot touch `httpOnly` cookies. Access tokens live in memory (short-lived anyway). Refresh tokens live in `httpOnly` cookies (long-lived, must be protected).

### Q9: What's a migration and why not init scripts?
**A:** A migration is a versioned, reversible database change. Init scripts run once and are never tracked. Migrations give history of every schema change, ability to roll back, and reliable incremental application across environments.

### Q10: How is real-time user presence (Online/Last Seen) tracked across microservices?
**A:** The Chat Service uses a Redis Set (`presence:{userId}`) to track connected device socket IDs. When a user disconnects their last device, the Chat Service publishes a `chat.user.offline` event to RabbitMQ. The User Service consumes this event and safely updates the exact `last_seen` timestamp in Postgres without blocking the chat infrastructure. When fetching a profile, the API natively checks the Redis cardinality to determine current "Online" status instantly.

### Q11: How do you prevent read-modify-write race conditions in MongoDB delivery receipts?
**A:** When multiple devices acknowledge delivery of a message simultaneously, reading the document, appending a device locally, and saving it can lead to one device overwriting another (lost update). The fix is to use atomic database-level operators like `$addToSet` and `$set`. This forces the database to serialize the updates, ensuring 100% accurate multi-device state tracking without manual locking.

### Q12: How do you test microservices without running the full stack?
**A:** Unit tests mock the repository layer — service logic is tested with fake database functions. Integration tests use `supertest` to simulate HTTP requests against an in-memory Express app with the service layer mocked. Zero Docker, zero database, zero running server required.

### Q13: How do you handle bidirectional relationships in a single database row?
**A:** Canonical ordering — always store the smaller UUID as `requester_id`. A `CHECK constraint` enforces this at the database level. All application queries sort IDs before lookup (`[userId, targetId].sort()`). This prevents duplicate rows for the same pair regardless of who initiated the relationship.

### Q14: How do you prevent duplicate friend requests?
**A:** The relationships table has a unique constraint on `(requester_id, receiver_id)` combined with canonical ordering. At the service layer, we check existing relationship status before inserting — blocked returns 403, pending returns 429, accepted returns 409. Rejected requests have a 24-hour cooldown tracked via `updated_at`.

### Q15: Why does unblock delete the relationship row instead of updating status?
**A:** After unblocking, there is no natural state to revert to. The relationship history is gone. Deleting the row lets both users start fresh — either can send a new buddy request as if they never connected.

### Q16: How do internal services identify the calling user?
**A:** The API Gateway extracts and verifies the JWT, then forwards the user identity as an `X-User-Id` header. Internal services read this header and trust it — they never touch the JWT directly. This keeps auth logic centralized in the Gateway.

### Q17: How does the API Gateway handle partial auth routes?
**A:** Specific prefixes (`/auth/register`, `/auth/login`, `/auth/verify/:token`) are registered as unprotected routes before the catch-all `/auth` prefix. Express matches routes in registration order — more specific routes win. This means public auth endpoints bypass JWT verification while every other `/auth/*` route (e.g. `/auth/logout`, `/auth/refresh`) requires a valid token.

### Q18: Why build a custom API Gateway instead of using Kong or Nginx?
**A:** For a portfolio project, a hand-rolled gateway demonstrates understanding of the underlying concerns — middleware ordering, JWT verification, rate limiting strategy, CORS policy, and proxy behaviour. Production systems would use a managed gateway (Kong, AWS API Gateway, or Nginx) for observability, plugin ecosystems, and operational simplicity.

### Q19: How does Socket.IO authentication work?
**A:** JWT is verified once at connection time via the handshake auth object. The decoded user identity is attached to `socket.data.userId` and trusted for the lifetime of the connection. Per-event auth would be redundant and expensive.

### Q20: Why use Socket.IO over raw WebSockets?
**A:** Socket.IO adds rooms, namespaces, automatic reconnection, and fallback to long-polling when WebSocket isn't available. Raw WebSockets require you to implement all of this yourself.

### Q21: How do you prevent users from editing other people's messages?
**A:** The service layer fetches the message before updating and checks `senderId === userId`. If they don't match, it throws a 403 equivalent error before touching the database.

### Q22: What is the singleton DM room pattern?
**A:** Before creating a DM room, the repository checks if a room already exists with exactly those two members and `kind=dm`. If it does, it returns the existing room. This prevents duplicate conversations between the same two users.

### Q23: Why not store files in PostgreSQL or on disk?
**A:** PostgreSQL BLOBs are slow and bloat the database. Server disk is ephemeral in Kubernetes — pods restart and lose local files. Object storage like S3/MinIO is designed for binary data, scales independently, and survives pod restarts.

### Q24: What is a presigned URL?
**A:** A time-limited signed URL generated by the server that gives the client temporary direct access to a private S3 object. The client fetches the file directly from MinIO/S3 — the file never passes through your service. Reduces server load and latency.

### Q25: How do you switch from MinIO to AWS S3 in production?
**A:** Change three env variables — `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`. The AWS SDK code is identical. This is the S3-compatible storage pattern.

### Q26: Why use multer memoryStorage instead of diskStorage?
**A:** `diskStorage` writes to the server's local filesystem first. In Kubernetes, that disk is ephemeral and not shared across pods. `memoryStorage` keeps the file in RAM as a Buffer, which is then immediately streamed to MinIO. No local disk dependency.

### Q27: How does the Notification Service know when to send an email?
**A:** It subscribes to RabbitMQ queues. Auth Service publishes an event like `auth.user.registered` with email and verification link. Notification Service receives it and sends the email. The two services never call each other directly, and RabbitMQ ensures the event isn't lost if the Notification Service is temporarily down.

### Q28: Why move email sending out of Auth Service?
**A:** Single responsibility. Auth Service owns credentials and tokens — not email delivery. If the email provider is down, Auth should still register the user successfully. Decoupling via events makes the system more resilient.

### Q29: How do you monitor a microservices system?
**A:** Three pillars — logs, metrics, traces. Winston for structured JSON logs with service name in every entry. `prom-client` exposes a `/metrics` endpoint on each service. Prometheus scrapes every 15 seconds and stores time-series data. Grafana visualizes CPU, memory, event loop lag, and HTTP latency across all services in real time.

### Q30: What metrics do you track?
**A:** Default Node.js metrics via `prom-client collectDefaultMetrics` — CPU, memory, heap, event loop lag. Custom HTTP metrics — request counter labeled by method/route/status, and a duration histogram with buckets at 10/50/100/200/500/1000ms for P95 latency analysis.

### Q31: Why JSON logs instead of plain text?
**A:** JSON logs are machine-parseable. You can filter by service, level, or any field. Plain text requires regex parsing which is fragile. In production, JSON logs feed directly into log aggregation tools like Loki or Datadog without transformation.

### Q32: Why does IndexedDB `db.put()` sometimes require three arguments instead of two?
**A:** When creating an object store without an inline `keyPath` (e.g., `db.createObjectStore("sessions")`), IndexedDB uses "out-of-line" keys. This means the key is completely separate from the stored value, so methods like `put()` or `add()` require you to explicitly pass the key as a separate argument: `db.put("sessions", value, key)`. If the store was created with an inline key path (e.g., `db.createObjectStore("sessions", { keyPath: "conversationId" })`), IndexedDB extracts the key directly from the value object, and you only need two arguments: `db.put("sessions", value)`.

### Q33: How does `db.put()` behave when called twice with the same key?
**A:** `put()` acts as an upsert (insert or update). If you call `db.put("sessions", state, "convo-123")` twice with different payloads, the second call will silently overwrite the existing record rather than duplicating it or throwing an error. If you want it to throw an error when a key already exists, you must use `db.add()` instead.

### Q34: How do you handle encrypting a message for the sender's own device in a Double Ratchet architecture?
**A:** We use a self-encryption loopback. You cannot establish a Double Ratchet session with yourself because the state machine is strictly directional (Alice to Bob). If a sender encrypts a message (turning the "send" ratchet) and then immediately decrypts their own bounced message (turning the "receive" ratchet on the same session object), the cryptographic state becomes fundamentally corrupted. Instead, when encrypting for the current device, we bypass the ratchet entirely and symmetrically encrypt the payload using a deterministic key derived directly from the device's local Identity Private Key.

### Q35: How do you handle backward compatibility when adding new fields to an IndexedDB schema?
**A:** You must implement a fallback generator. When loading an existing Identity Key from IndexedDB, we explicitly check if the new `signingPrivateKey` field exists. If it is missing (because the key was generated on an older version of the app), we bypass the cached key and gracefully regenerate a brand new identity bundle that complies with the updated schema, then silently register the new keys with the server.

### Q36: How do you handle End-to-End Encryption key registration failures during login?
**A:** If the key-service is down or fails during login, we catch the error, log a warning, and skip registration for that session without clearing or pruning any local data. The registration flow (`initializeE2EE`) is bound to a React `useEffect` dependent on the user ID, meaning it will automatically retry the next time the user logs in or does a hard refresh, eventually syncing the keys when the server recovers.
