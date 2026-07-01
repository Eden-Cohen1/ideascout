# M9 — Refinement Loop (design)

**Status:** approved · **Date:** 2026-07-01 · **Roadmap:** milestone 9 (`…8. research pipeline → 9. refinement → 10. front-end`)

## Purpose

Close the human-in-the-loop step of Phase 1: after a research run produces a
verdict, the user chats with an AI advisor about their idea. The advisor replies
(streamed), grounded in the idea and its research results, and may propose a
**structured edit** to the idea's content. The user can **apply** a proposal,
which creates a new immutable idea version.

This milestone builds on scaffolding that already exists — no schema changes:

- `RefinementMessage` Prisma model (`role`, `content`, `proposedPatch`, `appliedVersionId`)
- `@ideascout/shared` DTOs: `ProposedPatchSchema`, `PostRefinementMessageRequestSchema`,
  `ApplyRefinementRequestSchema`, `RefinementMessageResponseSchema`
- `REFINEMENT_ROLES` enum (`USER` / `ASSISTANT` / `SYSTEM`)
- `LlmProvider.stream()` for token streaming; `IdeasService.update()` for versioning

## Decisions (locked)

1. **Assistant reply streams over SSE** (token-by-token).
2. **Two-phase generation:** stream the natural-language reply, then a second
   structured LLM call extracts an optional `ProposedPatch`; deliver it in a
   terminal SSE event.
3. **Context** the advisor sees: idea current version + prior conversation history +
   latest SUCCEEDED research run **summary** (not the raw fetched corpus).
4. **Apply** = create the new version + link it (`appliedVersionId`). No automatic
   lifecycle transition, no automatic re-research — those stay explicit user actions.
5. **Streaming endpoint shape:** a single **POST that returns the SSE stream**
   directly (generation is synchronous/in-process — no queue or bridge). The web
   client (M10) reads it with `fetch()` + a stream reader, not `EventSource`.
6. **Real adapter streaming scope:** upgrade the **OpenAI (default) adapter** to true
   incremental streaming; Anthropic/Gemini keep the current emit-once `stream()` with
   a TODO. Mock already streams, so the feature is fully demoable/testable keyless.

## Non-goals (YAGNI)

- No lifecycle auto-transition or auto-re-research on apply.
- No streaming of the raw research corpus into context.
- No true streaming for Anthropic/Gemini this milestone.
- No store-interface seam — refinement is a normal Nest service using `PrismaService`
  directly, consistent with `ideas`/`projects`/`auth`. (The `ResearchStore` seam was
  pipeline-specific; replicating it here would be inconsistent over-abstraction.)

## Module layout

`apps/api/src/modules/refinement/`

| File | Responsibility |
|---|---|
| `refinement.module.ts` | Wires controller + service; imports `ProjectsModule` (guard), `PrismaModule`, providers (`LlmRegistry`). Registered in `app.module.ts`. |
| `refinement.controller.ts` | 3 routes under `projects/:projectId/ideas/:ideaId/refine`, guarded by `JwtAuthGuard` + `ProjectAccessGuard`, Swagger-documented. |
| `refinement.service.ts` | Thread list; generate message (stream + persist + patch-extract); apply patch. |
| `refinement.context.ts` | Pure builder: `(ideaVersion, latestRun, history) → LlmMessage[]`. Independently testable. |
| `refinement.prompt.ts` | Chat system prompt + patch-extraction prompt (isolated, like `pipeline/prompts`). |
| `*.spec.ts` | Co-located tests, TDD, mock-first. |

Each unit has one purpose and a well-defined interface: the context builder and
prompt builders are pure functions; the service depends on `PrismaService` +
`LlmRegistry`; the controller only does HTTP/SSE wiring.

## Endpoints

All under `projects/:projectId/ideas/:ideaId/refine`, guarded by `JwtAuthGuard` +
`ProjectAccessGuard` (per-project ownership is the whole access model).

### 1. `GET /refine` → `RefinementMessageResponse[]`
The conversation thread for the idea, oldest-first.

### 2. `POST /refine` (body `{ content }`) → SSE stream (`text/event-stream`)
Synchronous, in-process generation streamed back on the same request:

1. Persist the **USER** message.
2. Build context (see below); resolve the LLM via `LlmRegistry`.
3. `llm.stream(messages)` → write each chunk as a `token` SSE frame, accumulating
   the full reply text.
4. On stream completion: persist the **ASSISTANT** message (`content` = full reply).
5. Run patch-extraction (`llm.structured(...)`); if the result has any non-empty
   field, save it as the message's `proposedPatch`.
6. Write a terminal `message` SSE frame carrying the saved `RefinementMessageResponse`
   (id + `proposedPatch`), then end the response.

**Error handling:** if the stream or extraction throws mid-flight, write an `error`
SSE frame and end. The assistant message is persisted only on successful completion;
the user message always remains (so the thread shows what was asked).

### 3. `POST /refine/:messageId/apply` → updated idea (`IdeaWithVersion`)
Applies the message's `proposedPatch` onto the current version:

1. Load the message; assert it belongs to this idea, has a `proposedPatch`, and is not
   already applied (`appliedVersionId == null`).
2. Merge patch onto current version → new `IdeaVersion` (reuse `IdeasService.update`).
3. Set the message's `appliedVersionId` to the new version.
4. Return the updated idea with its current version.

Guard failures → `NotFoundException` (unknown/cross-idea message) or
`BadRequestException` (no patch / already applied).

## SSE event contract (new in `@ideascout/shared`)

`refinement-stream.event.ts` — a Zod discriminated union, mirroring where
`research-progress.event.ts` lives:

```ts
RefinementStreamEvent =
  | { type: 'token';   delta: string }
  | { type: 'message'; message: RefinementMessageResponse }   // terminal success
  | { type: 'error';   message: string }
```

Each frame is written as `data: <json>\n\n`.

## Context building

`buildRefinementContext(ideaVersion, latestRun, history) → LlmMessage[]`:

- **System prompt** (`refinement.prompt.ts`): advisor role; include the idea's current
  `problem` / `solution` / `targetCustomer`; if a SUCCEEDED research run exists, include
  its summary — `verdict`, `score`, key risks, competitor `marketSummary`, moat
  `summary` (pulled from the run's stored artifacts / relations, reusing the
  `research-detail.mapper` shapes).
- **History:** prior `RefinementMessage`s mapped `USER → user`, `ASSISTANT → assistant`.
- **New turn:** the incoming user `content`.

Provider/model resolution matches research: `project.llmProvider`/`llmModel` →
config default → `LlmRegistry.resolve()` (mock fallback when keyless).

## Patch extraction

After the reply streams, a structured call against an internal extraction schema
(problem?/solution?/targetCustomer? + short reasoning). If every edit field is
absent/empty → store `null` (no proposal). Under mock mode, `synthFromSchema`
yields a populated patch deterministically, so tests always exercise the
propose-and-apply path.

## LLM adapter streaming upgrade (OpenAI)

`FetchLlmProvider.stream()` today emits once. Add a real streaming path for the
OpenAI adapter: request `stream: true`, parse the provider's `data:` SSE lines, and
`yield` incremental `{ delta }` chunks, ending with `{ delta: '', done: true }`.
Anthropic/Gemini keep emit-once behavior with a `// TODO(streaming)` marker. The
refinement service depends only on the `LlmProvider.stream()` interface, so this
upgrade is transparent to it.

## Testing (TDD, mock-first)

- **`refinement.service`**: posting generates + persists a USER then ASSISTANT
  message; context includes idea + research + history; patch extracted and stored;
  `apply` creates a new version and links `appliedVersionId`; guards (message not
  found, cross-idea, no patch, already applied).
- **`refinement.context` / `refinement.prompt`**: pure-function unit tests (research
  summary present vs. absent; history mapping).
- **`refinement.controller`**: SSE tested via a mock `Response` capturing written
  frames — asserts `token…` frames precede a terminal `message` frame; error path
  emits an `error` frame.
- **OpenAI adapter streaming**: parse a canned SSE body into ordered deltas.
- **Swagger**: all three routes carry `@ApiTags('refinement')`, `@ApiBearerAuth()`,
  `@ApiOperation`; bodies use `@ApiZodBody`; the SSE route documents `text/event-stream`.

## Verification gate

`npm run typecheck` · `npm run lint` · `npm test` (apps/api) all green before the
milestone is considered done; mock mode runs the full loop keyless.
