# Talkie — End-to-End Encrypted Microservices Chat Application

A high-performance, portfolio-grade microservices chat platform featuring **Zero-Knowledge End-to-End Encryption (Signal Double-Ratchet + X3DH)**, real-time messaging, WebRTC video calling, voice notes, story feeds, and interactive slash commands. Built with Next.js, Express microservices, PostgreSQL, MongoDB, Redis, RabbitMQ, and Socket.IO.

**Stack:** Next.js 16 (Turbopack) · Node.js (TypeScript) · PostgreSQL · MongoDB · Redis · RabbitMQ · Socket.IO · WebRTC · Tailwind CSS v4 · Framer Motion

---

## 🌟 Key Features

### 🔒 Cryptography & Security (E2EE)
- **Zero-Knowledge Architecture**: All direct messages and audio attachments are encrypted client-side using **libsodium** before leaving the browser. The server only sees encrypted ciphertexts.
- **X3DH (Extended Triple Diffie-Hellman)**: Secure initial key exchange establishing ratcheted sessions without requiring both parties to be online simultaneously.
- **Double Ratchet Algorithm**: Provides forward secrecy and post-compromise security for every message exchange.
- **Client-Side Blob Encryption**: Audio recordings and file attachments are symmetrically encrypted in the browser with unique per-attachment secret keys embedded into the ratcheted message payload.

### 💬 Real-Time Workspace & Chat
- **Instant Messaging & Presence**: Real-time message delivery, typing indicators, online/offline presence tracking, and double-tick delivery & read receipts.
- **17+ Interactive Slash Commands**:
  - `/choose Option 1, Option 2, Option 3` — Randomly picks between comma-separated options.
  - `/topic` — Broadcasts a random conversation starter prompt.
  - `/spoiler secret text` — Sends text wrapped in an interactive blur mask.
  - `/quote` — Sends a random notable tech or philosophical quote.
  - `/timer <seconds>` — Broadcasts a countdown timer that notifies room members upon expiration.
  - `/vote question options: a, b, c` — Creates live interactive polls.
  - `/roll`, `/flip`, `/8ball`, `/shrug`, `/flip-table` — Fun social commands.
  - `/promote`, `/demote`, `/kick`, `/mute`, `/unmute` — Group administration controls with custom duration parsing (`30s`, `10m`, `1h`) and system announcements.
  - `/whisper`, `/request`, `/requests`, `/approve`, `/deny` — Group member requests and DMs.
- **Audio Messages & Voice Recorder**: Built-in voice message recorder with audio waveform previews, pause/resume, playback progress, and client-side E2EE encryption.
- **Message Replies & Forwarding**: Reply directly to specific messages with quoted bubbles or forward messages to other conversations.
- **Emoji Reactions**: Attach quick reactions to any message.

### 📹 Video Calls & Media
- **WebRTC Peer-to-Peer Calls**: Built-in audio/video call launcher with TURN/STUN credential fetching.
- **Stories Feed**: 24-hour disappearing photo, video, and text status updates.

### 🌐 Editorial Design System
- High-contrast, calm, retro-futuristic monochrome aesthetic with dot-matrix grid backgrounds, crisp typography, and smooth micro-animations.

---

## 🛠️ Architecture & Microservices

```
/
├── apps/
│   ├── api-gateway/          # Port 3000 — JWT verification, rate limiting, routing
│   ├── auth-service/         # Port 3001 — Credentials, refresh token rotation, verification
│   ├── user-service/         # Port 3002 — User profiles, relationships, buddy requests
│   ├── chat-service/         # Port 3003 — Rooms, messages, Socket.IO real-time engine
│   ├── file-service/         # Port 3004 — File uploads, MinIO/S3 storage, presigned URLs
│   ├── notification-service/ # Port 3005 — Async email dispatch (RabbitMQ consumer)
│   └── web/                  # Port 3000 (Next.js) — E2EE Client, UI design system
├── packages/
│   ├── shared-types/         # Shared TypeScript interfaces
│   └── shared-utils/         # Standard response helpers, validators
├── infrastructure/
│   └── docker/               # PostgreSQL & MongoDB init scripts
└── docker-compose.yml        # Infrastructure services
```

---

## 🚦 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18 or higher
- **Docker Desktop**: Running

### 2. Infrastructure Setup
```bash
# Clone the repository
git clone <repo-url>
cd chat-app

# Start PostgreSQL, MongoDB, Redis, and RabbitMQ
docker compose up -d

# Verify infrastructure status
docker compose ps
```

### 3. Start Backend Microservices & Frontend
```bash
# Install dependencies across monorepo
npm install

# Start development servers (Turbo)
npm run dev
```

The web client will be accessible at `http://localhost:3000`.

---

## 🧪 Testing & Verification

```bash
# Run web client build verification
npm run build --workspace=apps/web

# Run unit and integration tests across services
npm test
```

---

## 📜 Git Commit & Tag Instructions

To record all changes, visual redesign, E2EE fixes, group avatars, slash commands, and README updates, run the following commands:

```bash
git add .
git commit -m "feat(web): complete Talkie visual redesign, slash commands, E2EE fixes & docs"
git tag -a v1.2.0 -m "Release v1.2.0: Talkie complete redesign & features"
```