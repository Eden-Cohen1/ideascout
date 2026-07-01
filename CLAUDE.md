# CLAUDE.md — ideascout

Guidance for AI coding agents (and humans) working in this repo.

## What this is

`ideascout` automates startup-idea evaluation & validation. **Phase 1** (current):
multi-project idea workspace + AI research engine (GO/NO-GO + competitor map + moat
analysis, grounded in live web research with citations) + human-in-the-loop refinement
loop. Contact discovery, question generation, and outreach are **Phase 2/3** — designed
for, not yet built.

## Monorepo layout (npm workspaces)

- `packages/shared` — `@ideascout/shared`. Zod contracts + inferred TS types + enums +
  SSE event shapes. **Imported by both API and web. Change contracts here first.**
- `apps/api` — NestJS. HTTP API (`src/main.ts`) and BullMQ worker (`src/worker.ts`)
  boot the **same** DI container, so the worker reuses the same adapter registry,
  Prisma, and config. Module-per-feature under `src/modules/*`; research pipeline steps
  under `src/pipeline/steps/*`. Refinement (`src/modules/refinement/*`) adds the
  streamed AI-advisor loop: POST returns an SSE token stream; the advisor can propose
  idea-version patches.
- `apps/web` — Vue 3 + Vite + Pinia + TypeScript, shadcn-vue (Reka UI) + Tailwind.
- `infra/docker` — Postgres/Redis container config.

## Conventions

- **TypeScript everywhere**, `strict`. Contracts live in `@ideascout/shared` as Zod
  schemas; infer types with `z.infer`. The same schema validates LLM output, DB writes,
  API responses, and front-end parsing.
- **Adapter pattern** for all external services: a stable interface + concrete adapters
  (incl. a **deterministic mock**) + a registry that selects by config and **falls back
  to mock when no key is present**. Adding a provider = one adapter class + one registry
  entry; nothing else changes.
- **Mock mode is first-class.** Tests and keyless local dev must work fully. Never make
  the happy path depend on a real API key.
- Backend = CommonJS (standard NestJS). `apps/web` = ESM (Vite). `packages/shared`
  compiles to CommonJS so both consume it.
- Per-project ownership is the entire access model (`ProjectAccessGuard`): a user only
  sees their own projects. No heavy RBAC.
- **API docs (Swagger) — keep them current.** Interactive OpenAPI lives at `/api/docs`
  (set up in `apps/api/src/main.ts`). Every new controller gets `@ApiTags('<area>')`;
  guarded routes get `@ApiBearerAuth()`; each route gets `@ApiOperation({ summary })`;
  request bodies use `@ApiZodBody(Schema)` from `common/swagger.ts` so docs derive from
  the SAME shared Zod schema we validate against (no drift). New endpoints are not "done"
  until they're documented this way.
- **Auth & rate limiting.** The web frontend authenticates via an httpOnly,
  `SameSite=Lax` cookie (`apps/api/src/modules/auth/auth-cookie.util.ts`) — safe without
  CSRF tokens because web+API are always same-origin (Vite dev proxy / prod nginx).
  `JwtAuthGuard` reads the cookie first, falling back to a Bearer header for
  Swagger/API/non-browser clients. A global `ThrottlerModule` (100 req/min/IP default,
  `apps/api/src/app.module.ts`) guards every route; `login`/`register` use a tighter
  `@Throttle()` for brute-force protection. **Any future endpoint that triggers an AI
  provider call (research start, refinement message) must add its own explicit
  `@Throttle()` tighter than the global default** — this is the only real defense
  against API-cost abuse, since client-side guardrails alone are trivially bypassed.

## Common commands

```bash
npm install                 # install all workspaces
npm run build               # build shared, then apps
npm run typecheck           # type-check all workspaces
npm run lint                # eslint
npm test                    # all workspace tests
npm run dev:api             # NestJS watch
npm run dev:web             # Vite dev server
# docker compose up --build # full stack (finalized in the Docker milestone)
```

## Working norms

- **Dependencies are added per milestone.** Don't bulk-install; add a dep when the
  milestone that needs it lands (keeps the scaffold lean and the lockfile meaningful).
- Use **TDD** for backend logic; mock adapters make this deterministic.
- Keep files focused and small; one clear responsibility per module/service.
- Secrets: provider keys via env; per-project overrides are AES-256-GCM encrypted.
  Never log secrets. `.env` is gitignored; document new vars in `.env.example`.

## Roadmap (build order)

1. Scaffold → 2. shared contracts → 3. config/prisma/crypto infra → 4. data model →
5. auth + projects + ideas → 6. provider abstraction (mock-first) → 7. jobs/queue →
8. research pipeline → 9. refinement → 10. front-end → 11. Docker → 12. tests/CI.
