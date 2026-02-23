# Deployment Guide

> **Version**: 1.1.0
> **Last Updated**: Feb 23, 2026 (Local-First Windows Setup)

## Overview

Devonz is a **local-first Windows 11 application**. All persistence services (PostgreSQL/pgvector, Neo4j, Redis, MinIO) run locally via **Docker Desktop**. The only internet access required is for AI provider API calls (Anthropic, OpenAI, Google, etc.).

---

## Prerequisites

- **Node.js**: v20.19.0+ or v22.12.0+ (Strict Requirement for Vite 7)
- **pnpm**: v9+
- **Docker Desktop for Windows**: All database services run in local containers
- **Windows SDK** *(optional)*: Required only for MSIX packaging (`makeappx.exe`, `signtool.exe`)

---

## 1. Local Development Setup

### Step 1 — Clone & Install

```bash
git clone https://github.com/kherrera6219/Devonz.git
cd Devonz
pnpm install
```

### Step 2 — Configure Environment

```bash
cp .env.example .env.local
# Fill in your AI provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY)
# Local DB connection strings are pre-filled with docker-compose defaults — no changes needed
```

### Step 3 — Start Local Services (Docker Desktop required)

```bash
cd database
docker compose up -d
cd ..
```

This starts all four local services:

| Service | Port | Purpose |
| :--- | :--- | :--- |
| PostgreSQL + pgvector | 5432 | Relational data + semantic embeddings |
| MinIO | 9000 / 9001 | S3-compatible local file storage |
| Redis | 6379 | LangGraph checkpointer + caching |
| Neo4j | 7474 / 7687 | Knowledge graph for Researcher agent |

> **Note**: Services start with safe default passwords (`devonz_local_pass`, etc.) that match the pre-filled `.env.local` values. No manual password setup required for local dev.

### Step 4 — Start Development Server

```bash
pnpm run dev
```

Visit `http://127.0.0.1:5173` to start building.

> Use `127.0.0.1` instead of `localhost` to avoid Windows IPv6 resolution issues.

---

## 2. Environment Variables

### AI Provider Keys (required — internet access only)

| Variable | Provider | Where to Get |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | Anthropic (Architect agent) | console.anthropic.com |
| `OPENAI_API_KEY` | OpenAI (Coordinator + QC agents) | platform.openai.com |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google (Researcher agent) | makersuite.google.com |

### Local Infrastructure (pre-filled, matches docker-compose defaults)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://devonz_user:devonz_local_pass@127.0.0.1:5432/devonz_db` | PostgreSQL connection |
| `REDIS_URL` | `redis://:devonz_redis_pass@127.0.0.1:6379` | Redis connection |
| `NEO4J_URI` | `bolt://127.0.0.1:7687` | Neo4j Bolt connection |
| `S3_ENDPOINT` | `http://127.0.0.1:9000` | MinIO S3 endpoint |

### Security & Session

| Variable | Description |
| :--- | :--- |
| `APP_SECRET` | 32-character secret key for signing cookies and tokens |
| `ENCRYPTION_KEY` | 32-byte hex-encoded key for AES-256-GCM encryption |

---

## 3. Build & Production Run

### Build

```bash
pnpm run build
```

### Start (Production)

Runs startup validation and port conflict resolution before serving.

```bash
pnpm run start
```

---

## 4. Windows Desktop (MSIX)

For packaging as a Windows desktop app, use the provided script. This creates an isolated staging environment and sanitizes filenames for MSIX compatibility.

**Build:**

```powershell
./build-msix.ps1 -SkipBuild
```

*Use `-SkipBuild` if `pnpm run build` has already been run.*

**Install (requires Administrator):**

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

---

## Security Checklist

- [x] Set strong `APP_SECRET` and `ENCRYPTION_KEY` in production.
- [x] Verify HSTS and CSP headers are active (`entry.server.tsx`).
- [x] Confirm `SSRFGuard` internal IP range configuration.
- [x] Verify all local Docker services are healthy before starting the app.
- [x] Use `127.0.0.1` (not `localhost`) for all local service URLs on Windows.
