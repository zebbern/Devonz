# System Architecture

> **Version**: 1.1.0
> **Last Updated**: Feb 23, 2026 (Local-First Infrastructure)
> **ADR Registry**: [docs/adr](./docs/adr)

## Overview
Devonz is a multi-agent AI coding environment built on a modern web stack. It orchestrates specialized AI agents (Coordinator, Researcher, Architect) to plan, execute, and verify complex software tasks.

## High-Level Design

```mermaid
graph TD
    User[User Interaction] --> Client[Remix Client (React)]
    Client --> Server[Remix Server (Node/Edge)]
    Server --> Agents[Agent Orchestrator (LangGraph)]
    
    subgraph "Governance & Security"
        Agents --> Guardrails[Guardrail Service]
        Agents --> Audit[Audit Trail]
        Agents --> RBAC[RBAC Engine]
    end
    
    subgraph "Agent Layer (LangGraph)"
        Agents --> Coordinator[Coordinator — GPT-5.2]
        Agents --> Researcher[Researcher — Gemini-3-Flash]
        Agents --> Architect[Architect — Claude Opus 4.6]
        Agents --> QC[QC Agent — GPT-5-mini]
    end

    subgraph "Data Layer (Local Docker)"
        Agents --> PGVector[(PostgreSQL + pgvector\n127.0.0.1:5432)]
        Agents --> Neo4j[(Neo4j Graph DB\n127.0.0.1:7687)]
        Agents --> Redis[(Redis\n127.0.0.1:6379)]
        Agents --> MinIO[(MinIO S3\n127.0.0.1:9000)]
        Agents --> Encryption[Encryption Service]
    end
```

## Key Components

### 1. AI Governance Subsystem
-   **Guardrail Layer**: Real-time prompt injection detection and output moderation.
-   **Prompt Registry**: Versioned, centralized management of system prompts for MAS agents.
-   **Usage Monitor**: Redis-backed token tracking, cost estimation, and budget enforcement.
-   **Routing Engine**: Policy-based LLM selection (Cost, Latency, Precision).

### 2. Enhanced Data Layer
-   **Snapshot Integrity**: HMAC-SHA256 verification to prevent tampering of chat states.
-   **Encryption-at-Rest**: AES-256-GCM authenticated encryption for sensitive project data.
-   **Retention Engine**: Automated lifecycle management and data purging policies.
-   **Schema Parity**: Automated validation between Local (IndexedDB) and Local Postgres schemas.

### 3. Agent Orchestration
-   **Framework**: LangGraph (StateGraph with typed reducer channels).
-   **Pattern**: State Machine with cyclical graph nodes (Coordinator → Researcher → Architect → QC1 → QC2 → Fix loop → Finalize).
-   **Memory**: Short-term (Conversation) + Long-term (RAG/Embeddings) + Redis Checkpointer.

### 4. Persistence (All Local — Docker Desktop)

All persistence services run **locally via `database/docker-compose.yml`**. No cloud database required. Only AI provider API calls use the internet.

| Service | Local Address | Purpose |
| :--- | :--- | :--- |
| PostgreSQL + pgvector | `127.0.0.1:5432` | Relational data + semantic embeddings |
| Neo4j | `bolt://127.0.0.1:7687` | Knowledge graph for Researcher agent |
| Redis | `127.0.0.1:6379` | LangGraph checkpoint saver, rate limiting, usage metrics |
| MinIO | `http://127.0.0.1:9000` | S3-compatible local file and backup storage |
| IndexedDB | Browser | Chat history + offline capability (HMAC-SHA256 integrity) |

> **Windows Note**: Use `127.0.0.1` not `localhost` for all service URLs to avoid IPv6 resolution issues on Windows.

## Data Flow

1.  **User Request**: User sends a prompt via Chat UI.
2.  **Security Gating**: `SSRFGuard` validates outgoing requests; `GuardrailService` inspects the prompt.
3.  **Startup Validation**: `StartupValidator` ensures environment health; `PortResolution` handles local port availability.
4.  **Orchestration**: `api.chat.ts` receives request, `OrchestratorService` spins up the LangGraph graph.
4.  **Agent Logic**: 
    -   `ModelRoutingEngine` selects the optimal LLM based on policy.
    -   Agents (Coordinator -> Researcher -> Architect) interact to solve the task.
5.  **Tool Execution**: Agents call tools which execute inside the **WebContainer** (browser-side) or Server (file system).
6.  **Persistence**: Every interaction is logged to `AuditTrail`; Project state is encrypted via `EncryptionService`.
7.  **Streaming Response**: Results are moderated by Guardrails and streamed back to the UI.

## Security Architecture
-   **Network**: SSRF protection for all external API connectors.
-   **Identity**: RBAC enforcement engine and secure session management.
-   **Secrets**: OS-level vault integration (Keychain/Credential Manager) for API keys.
-   **Privacy**: Automated log redaction for sensitive entities (Keys, IPs, PII).
-   **Sandboxing**: isolated WebContainers for code execution.
