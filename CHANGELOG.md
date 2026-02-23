# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-23

### Changed
- **Architecture**: Converted from cloud-hosted database to **local-first Windows 11** setup. All persistence services (PostgreSQL/pgvector, Neo4j, Redis, MinIO) now run locally via Docker Desktop — no cloud database required. Only AI provider API calls require internet.
- **Infrastructure**: `database/docker-compose.yml` — replaced mandatory `:?Set X in .env` password syntax with `:-safe_default` values so Docker starts out-of-box without requiring a `.env` file.
- **Config**: `.env.example` — local DB connection strings (`DATABASE_URL`, `REDIS_URL`, `NEO4J_URI`, `S3_ENDPOINT`) are now active (not commented out), use `127.0.0.1` instead of `localhost` to avoid Windows IPv6 issues, and `VITE_LOG_LEVEL` changed from `debug` to `info`.
- **Config**: `database/.env.example` — all `CHANGE_ME_TO_SECURE_PASSWORD` placeholders updated to match docker-compose safe defaults for seamless local dev.
- **Docs**: Updated `README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md` to reflect local-first setup.

### Fixed
- **Agent — QC** (`agents/qc.ts`): Removed `import.meta.env.VITE_OPENAI_API_KEY` (Vite client-only API that crashes on the server). Replaced with `process.env.OPENAI_API_KEY`. Changed model from `gpt-4o` → `gpt-5-mini`. Fixed `runCompletenessCheck` which always returned `pass: true` regardless of task state — now correctly detects pending tasks, sets `pass: false`, increments `high` severity count, and routes the graph stage back to `ARCH_BUILD` for a fix pass.
- **LLM — Reasoning detection** (`constants.ts`): Removed leftover debug `console.log(REGEX TEST: ...)` that fired on every model check in production.
- **LLM — Streaming** (`stream-text.ts`): Removed two `DEBUG STREAM` `logger.info` blocks that logged full request parameters and filtered options on every stream invocation.

## [1.1.0] - 2026-02-14

### Added
- **Stability**: Achieved **Zero-Error State** across the entire codebase (verified via `typecheck` and `lint`).
- **Storybook**: Standardized all `.stories.tsx` files to use `@storybook/react-vite`.
- **Infrastructure**: Automated cleanup of legacy build logs and temporary artifacts.

### Changed
- **Linter**: renomed Storybook decorator parameters to `storyComponent` for naming convention compliance.
- **Imports**: Converted all restricted relative imports to use the `~/` alias.
- **Refactor**: Surgically removed dozens of unused variables and parameters across the system.

### Fixed
- **Parsing**: Resolved syntax and parsing errors in `entry.server.tsx`.
- **Logic**: Fixed unhandled catch blocks and hidden characters in `metrics.server.ts`.
- **Dependencies**: Resolved missing `@remix-run/testing` and `jest-axe` in Storybook modules.

## [Unreleased]

### Added
-   **Security**: Microsoft Standard Headers (CSP, HSTS) in `entry.server.tsx`.
-   **Security**: Production error sanitization in `root.tsx`.
-   **Documentation**: Comprehensive docs (`ARCHITECTURE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`).
-   **Feature**: Fluent Design UI overhaul (Mica, Acrylic, Semantic Buttons).
-   **Feature**: High-performance chat history (IndexedDB v3 + Pagination).
-   **Database**: `pgvector` schema migration for RAG.

### Changed
-   **Refactor**: Updated outdated `package.json` dependencies.
-   **UI**: Replaced Inter font with Segoe UI Variable stack.
-   **Optimization**: Limited initial chat load to improve TTI.

### Fixed
-   **Persistence**: Fixed import paths and restored logic in `BackupService` (`backup.ts`).
-   **Governance**: Resolved module resolution errors in `exporter.ts`, `migration.ts`, and `retention.ts`.
-   **Security**: Verified and fixed test imports in `security.test.ts`.
-   **Storybook**: Resolved `@remix-run/testing` dependency issues in `ChatBox.stories.tsx`.
