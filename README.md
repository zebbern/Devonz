# Devonz

![Devonz](https://github.com/user-attachments/assets/e4c3067d-2539-4b5e-abab-d129d90b51dc)

**Build anything with AI. Precision coding, orchestrated.**

> **Version**: 2.1.0
> **Status**: Production Ready (10/10 Hardened)
> **Last Updated**: Feb 23, 2026

Devonz is a sophisticated **multi-agent AI development environment** designed to accelerate full-stack application building. By orchestrating specialized agents (Coordinator, Researcher, Architect) via **LangGraph**, it transforms natural language requests into production-grade code with precision and context-awareness.

Built on the latest **Remix** and **Vite 7** stack, it offers a blazing fast, secure, and enterprise-ready foundation for AI-assisted engineering.

---

## 📚 Documentation

| Guide | Description |
| :--- | :--- |
| [**Architecture**](./ARCHITECTURE.md) | System design, agent orchestration, and data flow diagrams. |
| [**Deployment**](./DEPLOYMENT.md) | Production setup, environment variables, and build requirements. |
| [**Security**](./SECURITY.md) | Vulnerability reporting, policies, and security subsystems. |
| [**Desktop Governance**](./docs/DESKTOP_GOVERNANCE.md) | Windows installer (`.msix`), updates, and port management. |
| [**Release Checklist**](./docs/RELEASE_CHECKLIST.md) | Standardized workflow for reliable production deployments. |
| [**Project Structure**](./docs/PROJECT_STRUCTURE.md) | Annotated map of the file system and key directories. |

---

## ✨ Key Features (2026 Edition)

Devonz has been re-architected for performance, security, and scalability.

### 🧠 Intelligent Orchestration
*   **Multi-Agent System**: Specialized agents (Coordinator, Researcher, Architect) work in concert via **LangGraph** to solve complex tasks.
*   **Contextual Memory**: Hybrid persistence using **PostgreSQL** (Relational), **pgvector** (Semantic), and **Neo4j** (Graph) for deep context retention.
*   **WebContainer Runtime**: Executes code safely in a browser-based Node.js sandbox, ensuring secure & isolated environments.

### 🛡️ Enterprise-Grade Security
*   **Zero Trust Architecture**: **RBACGuard** enforces role-based access on all sensitive routes (`/api/deploy`, `/api/secrets`).
*   **AI Governance**: Real-time prompt injection detection, guardrails, and usage monitoring (Token/Cost tracking).
*   **API Hardening**: comprehensive **Rate Limiting** and **Zod Input Validation** on all agent endpoints.
*   **Data Protection**: **AES-256** encryption-at-rest for sensitive data.

### ⚡ Modern Infrastructure
*   **Bleeding Edge Stack**: Upgraded to **React 19 RC** and **Vite 7** for instant HMR and optimized builds.
*   **Fluent Design**: Stunning, native-class Windows 11 aesthetics (Mica, Acrylic) powered by **UnoCSS** and **Tailwind**.
*   **Resilient Persistence**: Local-first architecture using **IndexedDB** with robust cloud synchronization.

### ✅ Strict Quality Assurance
*   **Zero-Error Policy**: Global CI/CD pipeline enforces 100% test passing, linting compliance, and type safety.
*   **Current Status**: **335/335 Tests Passing** (Unit, Integration, E2E).
*   **Security Audited**: Proactive dependency management and regular vulnerability scans.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: v20.19.0+ or v22.12.0+ (Strict requirement for Vite 7)
* **pnpm**: v9+
* **Docker Desktop for Windows** (for local database services)

### Installation

1. **Clone & Install**

    ```bash
    git clone https://github.com/kherrera6219/Devonz.git
    cd Devonz
    pnpm install
    ```

2. **Configure Environment**

    ```bash
    cp .env.example .env.local
    # Fill in your AI provider API keys — local DB strings are pre-filled
    ```

3. **Start Local Services**

    ```bash
    cd database && docker compose up -d && cd ..
    ```

    Starts PostgreSQL, Redis, Neo4j, and MinIO locally via Docker Desktop.

4. **Start Development Server**

    ```bash
    pnpm run dev
    ```

    Visit `http://127.0.0.1:5173` to start building.

> **Local-first**: All database services run on your machine. Only AI provider API calls require internet access.

---

## 🛠️ Tech Stack

* **Frontend**: Remix, React 19 RC, Vite 7, UnoCSS, Tailwind CSS
* **AI/LLM**: Vercel AI SDK, LangGraph, LangChain
* **Database**: PostgreSQL, pgvector, Neo4j, Redis, MinIO
* **Local Persistence**: IndexedDB, Nanostores
* **Testing**: Vitest, Playwright, Testing Library

---

> [!NOTE]
> This project follows [Microsoft Open Source](https://opensource.microsoft.com/codeofconduct/) standards. For contribution guidelines, please see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 👏 Credits & Acknowledgements

**Devonz** is built upon the excellent foundation of [bolt.new](https://github.com/stackblitz/bolt.new) by **StackBlitz**.

*   **Original Concept**: StackBlitz Team
*   **Foundation**: Remix + Vite Template
*   **Inspiration**: The `bolt.new` architecture provided the initial spark for this multi-agent evolution.

We strictly adhere to the MIT License and open-source principles.
