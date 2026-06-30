# ideascout

> Automated startup-idea evaluation & validation. Turn a one-line idea into a cited
> **GO / NO-GO** recommendation, a **competitor map**, and a **defensible-moat analysis**
> via live AI-driven web research — with a human-in-the-loop refinement loop.

This repository currently contains the **Phase 1 scaffold**. See
[`docs`](#project-status) and the implementation plan for the full roadmap.

## Architecture

A Dockerized **npm-workspaces monorepo**:

| Workspace | Stack | Purpose |
| --- | --- | --- |
| `packages/shared` | TypeScript + Zod | Single source of truth for contracts (DTOs, AI structured-output schemas, enums, SSE events) shared by API and web. |
| `apps/api` | NestJS (TypeScript) | HTTP API **and** the BullMQ background worker (same image, two entrypoints: `main.ts` / `worker.ts`). |
| `apps/web` | Vue 3 + Vite + Pinia | SPA front-end (shadcn-vue / Tailwind). |
| `infra/docker` | Postgres + Redis config | Container support files. |

**Key design ideas**

- **Adapter / plugin pattern** for every external dependency (AI providers, web-search
  providers, future enrichment + outreach channels) behind stable interfaces.
- **Mock mode**: with no API keys set, the app runs end-to-end with deterministic
  fake data — ideal for local dev, CI, and demos.
- **Multi-provider AI**: OpenAI by default; Anthropic (Claude) and Google Gemini are
  configurable alternates behind one interface.
- **Citation grounding**: research citations are validated against pages actually
  fetched in the run — no hallucinated sources.

## Prerequisites

- Node.js **24+** (`.nvmrc` pins `24`)
- npm **11+**
- Docker + Docker Compose v2 (for the full stack)

## Getting started (local)

```bash
# 1. install all workspaces
npm install

# 2. configure env (mock mode works with blank provider keys)
cp .env.example .env

# 3. (later milestones) bring up the full stack
# docker compose up --build
```

## Scripts (root)

| Command | Description |
| --- | --- |
| `npm run build` | Build `shared`, then all workspaces. |
| `npm run typecheck` | Type-check all workspaces. |
| `npm run lint` | ESLint across the repo. |
| `npm run format` | Prettier write. |
| `npm test` | Run all workspace tests. |
| `npm run dev:api` / `npm run dev:web` | Run a single app in watch mode. |

## Project status

**Phase 1 (in progress):** idea workspace + AI research engine (GO/NO-GO, competitors,
moat) + refinement loop + AI provider abstraction + Docker infra.

**Phase 2/3 (designed, not built):** contact discovery, validation-question generation,
and compliance-first outreach. The data model and adapter architecture already
anticipate these so they slot in additively.

> Dependencies are added **per milestone** (e.g. Prisma, BullMQ, provider SDKs arrive
> with the milestone that uses them) to keep the scaffold lean and installable.
