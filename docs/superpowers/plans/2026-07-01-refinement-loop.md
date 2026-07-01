# Refinement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a streamed AI-advisor refinement loop: the user chats with an advisor grounded in their idea + its research results, the advisor may propose a structured idea-version edit, and the user can apply it to create a new version.

**Architecture:** A new NestJS module `apps/api/src/modules/refinement/`. A single streaming `POST` returns `text/event-stream` — the service exposes an async generator of `RefinementStreamEvent`s (token frames, then a terminal message frame), and the controller writes each as an SSE frame via the raw Express `Response`. Generation is synchronous/in-process (no queue). Provider/LLM stays behind `LlmRegistry`; persistence uses `PrismaService` directly (same as `ideas`/`projects`). The OpenAI adapter gains true incremental `stream()`.

**Tech Stack:** NestJS 11 (CommonJS), Prisma, Zod (`@ideascout/shared`), Jest, Express (`@Res`), `LlmProvider.stream()`/`structured()`.

## Global Constraints

- **TypeScript strict everywhere.** Contracts are Zod schemas in `@ideascout/shared`; infer types with `z.infer`.
- **Mock-first is first-class.** The full loop must run keyless/deterministic; never make the happy path depend on a real key. Tests use `MockLlmProvider`.
- **TDD** for all backend logic; write the failing test first.
- **No new dependencies** this milestone (Express `@Res` and global `fetch` are already available).
- **Run all tests/typecheck/lint from `apps/api/`** (e.g. `cd apps/api && npx jest <path>`), except the root `npm run typecheck` / `npm run lint` which run all workspaces.
- **Swagger stays current:** every new route gets `@ApiTags('refinement')`, `@ApiBearerAuth()`, `@ApiOperation({ summary })`; JSON request bodies use `@ApiZodBody(Schema)`.
- **Commit after each task** with a `feat(api):` / `feat(shared):` message.
- Branch: `feat/refinement` (already created).

---

## Task 1: SSE event contract in `@ideascout/shared`

**Files:**
- Create: `packages/shared/src/events/refinement-stream.event.ts`
- Modify: `packages/shared/src/index.ts` (add export)
- Test: `packages/shared/src/events/refinement-stream.event.test.ts`

**Interfaces:**
- Produces: `RefinementStreamEventSchema` (Zod discriminated union) and type `RefinementStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'message'; message: RefinementMessageResponse }
  | { type: 'error'; message: string }`. Reuses `RefinementMessageResponseSchema` from `../dto/refinement.dto`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/events/refinement-stream.event.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RefinementStreamEventSchema } from './refinement-stream.event';

describe('RefinementStreamEventSchema', () => {
  it('accepts a token event', () => {
    const e = { type: 'token', delta: 'Hel' };
    expect(RefinementStreamEventSchema.parse(e)).toEqual(e);
  });

  it('accepts a terminal message event', () => {
    const e = {
      type: 'message',
      message: {
        id: 'm1',
        role: 'ASSISTANT',
        content: 'hi',
        proposedPatch: null,
        appliedVersionId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    };
    expect(RefinementStreamEventSchema.parse(e)).toMatchObject({ type: 'message' });
  });

  it('accepts an error event', () => {
    expect(RefinementStreamEventSchema.parse({ type: 'error', message: 'boom' }).type).toBe('error');
  });

  it('rejects an unknown type', () => {
    expect(() => RefinementStreamEventSchema.parse({ type: 'nope' })).toThrow();
  });
});
```

> Note: `packages/shared` tests use **vitest** (see sibling `*.test.ts` files), not jest.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/events/refinement-stream.event.test.ts`
Expected: FAIL — cannot find module `./refinement-stream.event`.

- [ ] **Step 3: Write the schema**

Create `packages/shared/src/events/refinement-stream.event.ts`:

```ts
import { z } from 'zod';
import { RefinementMessageResponseSchema } from '../dto/refinement.dto';

/**
 * Frames streamed over the refinement SSE endpoint (`POST .../refine`). The advisor's
 * reply arrives as a run of `token` frames, then exactly one terminal frame: a
 * `message` (the persisted assistant message + any proposed patch) on success, or an
 * `error` on failure.
 */
export const RefinementStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), delta: z.string() }),
  z.object({ type: z.literal('message'), message: RefinementMessageResponseSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type RefinementStreamEvent = z.infer<typeof RefinementStreamEventSchema>;
```

- [ ] **Step 4: Add the barrel export**

In `packages/shared/src/index.ts`, add alongside the other `events/*` export (find the line exporting `./events/research-progress.event` and add below it):

```ts
export * from './events/refinement-stream.event';
```

- [ ] **Step 5: Run test to verify it passes + build shared**

Run: `cd packages/shared && npx vitest run src/events/refinement-stream.event.test.ts && npm run build`
Expected: PASS; build succeeds (so the API can import the new type).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/events/refinement-stream.event.ts packages/shared/src/events/refinement-stream.event.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): refinement SSE stream event contract"
```

---

## Task 2: True incremental streaming for the OpenAI adapter

**Files:**
- Modify: `apps/api/src/modules/providers/llm/adapters/openai.adapter.ts` (add `stream()` override + a private SSE-parsing helper)
- Test: `apps/api/src/modules/providers/llm/adapters/openai.adapter.spec.ts` (add a streaming describe block)

**Interfaces:**
- Consumes: `LlmStreamChunk` (`{ delta: string; done: boolean }`), `LlmMessage`, `LlmCallOptions` from `../llm-provider.interface`.
- Produces: `OpenAiLlmProvider.stream(messages, opts?)` overriding the base emit-once behavior with real per-token chunks; ends with `{ delta: '', done: true }`.

**Background:** `FetchLlmProvider.stream()` (base) currently calls `complete()` and yields once. OpenAI's streaming API returns `text/event-stream` with lines like `data: {"choices":[{"delta":{"content":"Hel"}}]}` and a final `data: [DONE]`. We override `stream()` in the OpenAI adapter to parse those. Anthropic/Gemini keep the base behavior (leave a `// TODO(streaming)` note — see Step 7).

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/modules/providers/llm/adapters/openai.adapter.spec.ts` (append a new describe; keep existing tests). First check the top of the file for how `AppConfigService` is mocked and reuse that pattern. Add:

```ts
describe('OpenAiLlmProvider.stream', () => {
  function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
    const enc = new TextEncoder();
    const lines = [
      ...chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`),
      'data: [DONE]\n\n',
    ];
    return new ReadableStream({
      start(controller) {
        for (const l of lines) controller.enqueue(enc.encode(l));
        controller.close();
      },
    });
  }

  it('yields a chunk per token then a terminal done', async () => {
    const config = {
      providerKey: () => 'sk-test',
      llm: { defaultProvider: 'openai', defaultModel: undefined },
    } as unknown as AppConfigService;
    const provider = new OpenAiLlmProvider(config);

    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(sseBody(['Hel', 'lo']), { status: 200 }));

    const deltas: string[] = [];
    let doneSeen = false;
    for await (const chunk of provider.stream([{ role: 'user', content: 'hi' }])) {
      if (chunk.delta) deltas.push(chunk.delta);
      if (chunk.done) doneSeen = true;
    }

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(doneSeen).toBe(true);
    fetchMock.mockRestore();
  });
});
```

If the existing file doesn't import `AppConfigService` and `OpenAiLlmProvider` at the top, add those imports (match the existing spec's imports for `../llm-provider.interface` types if needed).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/providers/llm/adapters/openai.adapter.spec.ts -t "yields a chunk per token"`
Expected: FAIL — current `stream()` calls `complete()` (which calls `postJson`), so it makes one non-stream request and yields once; `deltas` will not equal `['Hel','lo']`.

- [ ] **Step 3: Implement the streaming override**

In `apps/api/src/modules/providers/llm/adapters/openai.adapter.ts`, add imports for the stream types and append these methods to the class (after `complete`):

```ts
  async *stream(
    messages: LlmMessage[],
    opts?: LlmCallOptions,
  ): AsyncIterable<LlmStreamChunk> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.providerKey('openai')}`,
      },
      body: JSON.stringify({
        model: this.model(opts),
        messages,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
      signal: opts?.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`openai stream failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const delta = this.parseStreamFrame(frame);
        if (delta === '[DONE]') {
          yield { delta: '', done: true };
          return;
        }
        if (delta) yield { delta, done: false };
      }
    }
    yield { delta: '', done: true };
  }

  /** Extract the token from one SSE frame, or '[DONE]' at end-of-stream, or '' to skip. */
  private parseStreamFrame(frame: string): string {
    const line = frame.split('\n').find((l) => l.startsWith('data:'));
    if (!line) return '';
    const payload = line.slice('data:'.length).trim();
    if (payload === '[DONE]') return '[DONE]';
    try {
      const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
      return json.choices?.[0]?.delta?.content ?? '';
    } catch {
      return '';
    }
  }
```

Add these imports at the top of the file (extend the existing `import type { ... } from './... llm-provider.interface'` — actually the existing import is from `../llm-provider.interface`):

```ts
import type {
  LlmCallOptions,
  LlmChatResult,
  LlmFinishReason,
  LlmMessage,
  LlmStreamChunk,
} from '../llm-provider.interface';
```

(That replaces the existing type import block, adding `LlmStreamChunk`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/providers/llm/adapters/openai.adapter.spec.ts`
Expected: PASS (all tests in the file, old + new).

- [ ] **Step 5: Add the TODO markers to the other adapters**

In `apps/api/src/modules/providers/llm/adapters/anthropic.adapter.ts` and `apps/api/src/modules/providers/llm/adapters/gemini.adapter.ts`, add a one-line comment just above the class declaration:

```ts
// TODO(streaming): inherits emit-once stream() from FetchLlmProvider; add true streaming later.
```

- [ ] **Step 6: Run the full provider suite**

Run: `cd apps/api && npx jest src/modules/providers/llm`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/providers/llm/adapters/
git commit -m "feat(api): true incremental streaming for the OpenAI LLM adapter"
```

---

## Task 3: Prompt + patch-extraction schema

**Files:**
- Create: `apps/api/src/modules/refinement/refinement.prompt.ts`
- Test: `apps/api/src/modules/refinement/refinement.prompt.spec.ts`

**Interfaces:**
- Consumes: `LlmMessage` from `../providers/llm/llm-provider.interface`.
- Produces:
  - `REFINEMENT_SYSTEM_PROMPT: string`
  - `PatchExtractionSchema` (Zod) with type `PatchExtraction = { problem?: string; solution?: string; targetCustomer?: string; reasoning?: string }`
  - `patchExtractionMessages(ideaBrief: string, reply: string): LlmMessage[]`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/refinement/refinement.prompt.spec.ts`:

```ts
import {
  PatchExtractionSchema,
  REFINEMENT_SYSTEM_PROMPT,
  patchExtractionMessages,
} from './refinement.prompt';

describe('refinement.prompt', () => {
  it('system prompt describes the advisor role', () => {
    expect(REFINEMENT_SYSTEM_PROMPT.toLowerCase()).toContain('advisor');
  });

  it('patch extraction messages include the reply and idea brief', () => {
    const msgs = patchExtractionMessages('Problem: X', 'You should narrow the audience.');
    expect(msgs[0].role).toBe('system');
    expect(msgs.at(-1)?.content).toContain('narrow the audience');
    expect(msgs.at(-1)?.content).toContain('Problem: X');
  });

  it('PatchExtractionSchema allows an empty object (no proposed changes)', () => {
    expect(PatchExtractionSchema.parse({})).toEqual({});
  });

  it('PatchExtractionSchema keeps provided fields', () => {
    expect(PatchExtractionSchema.parse({ problem: 'new' }).problem).toBe('new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.prompt.spec.ts`
Expected: FAIL — cannot find module `./refinement.prompt`.

- [ ] **Step 3: Implement the prompts + schema**

Create `apps/api/src/modules/refinement/refinement.prompt.ts`:

```ts
import { z } from 'zod';
import type { LlmMessage } from '../providers/llm/llm-provider.interface';

/** System persona for the refinement chat. */
export const REFINEMENT_SYSTEM_PROMPT =
  'You are a startup advisor helping the founder refine their idea. Be specific, ' +
  'candid, and constructive. Use the research findings provided as context. When you ' +
  'recommend concrete changes to the idea, state them plainly in your reply — a ' +
  'separate step will turn them into a structured patch.';

/**
 * Internal-only contract for the second (structured) LLM call that extracts a proposed
 * idea edit from the advisor's reply. Every field is optional: an empty object means
 * "no change proposed". Kept here (not in @ideascout/shared) because it never crosses a
 * boundary — the API turns it into the shared `ProposedPatch` before persisting.
 */
export const PatchExtractionSchema = z.object({
  problem: z.string().optional(),
  solution: z.string().optional(),
  targetCustomer: z.string().optional(),
  reasoning: z.string().optional(),
});

export type PatchExtraction = z.infer<typeof PatchExtractionSchema>;

/** Messages for the patch-extraction call: given the idea + the advisor reply, emit edits. */
export function patchExtractionMessages(ideaBrief: string, reply: string): LlmMessage[] {
  return [
    {
      role: 'system',
      content:
        'Extract any concrete edits to the idea implied by the advisor reply. Return a ' +
        'JSON object with optional fields problem, solution, targetCustomer, and reasoning. ' +
        'Only include a field if the reply clearly recommends changing it; otherwise omit ' +
        'it. If nothing should change, return {}.',
    },
    {
      role: 'user',
      content: `=== CURRENT IDEA ===\n${ideaBrief}\n\n=== ADVISOR REPLY ===\n${reply}`,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.prompt.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.prompt.ts apps/api/src/modules/refinement/refinement.prompt.spec.ts
git commit -m "feat(api): refinement prompts + patch-extraction schema"
```

---

## Task 4: Context builder

**Files:**
- Create: `apps/api/src/modules/refinement/refinement.context.ts`
- Test: `apps/api/src/modules/refinement/refinement.context.spec.ts`

**Interfaces:**
- Consumes: `LlmMessage` from `../providers/llm/llm-provider.interface`; `REFINEMENT_SYSTEM_PROMPT` from `./refinement.prompt`.
- Produces:
  - types `IdeaSnapshot = { problem: string; solution: string; targetCustomer: string | null }`,
    `ResearchSummary = { verdict: string; score: number | null; keyRisks: string[]; marketSummary?: string; moatSummary?: string }`,
    `HistoryTurn = { role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }`
  - `ideaBrief(idea: IdeaSnapshot): string`
  - `buildRefinementContext(idea: IdeaSnapshot, research: ResearchSummary | null, history: HistoryTurn[], userMessage: string): LlmMessage[]`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/refinement/refinement.context.spec.ts`:

```ts
import { buildRefinementContext, ideaBrief } from './refinement.context';

const idea = { problem: 'Founders waste time', solution: 'AI evaluator', targetCustomer: 'Solo founders' };

describe('refinement.context', () => {
  it('ideaBrief includes all present fields', () => {
    const brief = ideaBrief(idea);
    expect(brief).toContain('Founders waste time');
    expect(brief).toContain('Solo founders');
  });

  it('starts with a system message and ends with the user message', () => {
    const msgs = buildRefinementContext(idea, null, [], 'Should I narrow the market?');
    expect(msgs[0].role).toBe('system');
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'Should I narrow the market?' });
  });

  it('includes the research summary in the system message when present', () => {
    const msgs = buildRefinementContext(
      idea,
      { verdict: 'CONDITIONAL_GO', score: 55, keyRisks: ['Crowded market'], marketSummary: 'Busy space', moatSummary: 'Thin moat' },
      [],
      'hi',
    );
    expect(msgs[0].content).toContain('CONDITIONAL_GO');
    expect(msgs[0].content).toContain('Crowded market');
    expect(msgs[0].content).toContain('Busy space');
  });

  it('maps history turns to chat roles in order', () => {
    const msgs = buildRefinementContext(
      idea,
      null,
      [
        { role: 'USER', content: 'first' },
        { role: 'ASSISTANT', content: 'reply' },
      ],
      'second',
    );
    const roles = msgs.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.context.spec.ts`
Expected: FAIL — cannot find module `./refinement.context`.

- [ ] **Step 3: Implement the context builder**

Create `apps/api/src/modules/refinement/refinement.context.ts`:

```ts
import type { LlmMessage, LlmRole } from '../providers/llm/llm-provider.interface';
import { REFINEMENT_SYSTEM_PROMPT } from './refinement.prompt';

export interface IdeaSnapshot {
  problem: string;
  solution: string;
  targetCustomer: string | null;
}

export interface ResearchSummary {
  verdict: string;
  score: number | null;
  keyRisks: string[];
  marketSummary?: string;
  moatSummary?: string;
}

export interface HistoryTurn {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

/** Compact description of the current idea, shared by the chat + patch-extraction prompts. */
export function ideaBrief(idea: IdeaSnapshot): string {
  const lines = [`Problem: ${idea.problem}`, `Solution: ${idea.solution}`];
  if (idea.targetCustomer) lines.push(`Target customer: ${idea.targetCustomer}`);
  return lines.join('\n');
}

function researchBlock(research: ResearchSummary): string {
  const lines = [
    `Verdict: ${research.verdict}${research.score !== null ? ` (score ${research.score}/100)` : ''}`,
  ];
  if (research.keyRisks.length) lines.push(`Key risks: ${research.keyRisks.join('; ')}`);
  if (research.marketSummary) lines.push(`Market: ${research.marketSummary}`);
  if (research.moatSummary) lines.push(`Moat: ${research.moatSummary}`);
  return lines.join('\n');
}

const ROLE_MAP: Record<HistoryTurn['role'], LlmRole> = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

/** Assemble the chat context: system (persona + idea + research) → history → new user turn. */
export function buildRefinementContext(
  idea: IdeaSnapshot,
  research: ResearchSummary | null,
  history: HistoryTurn[],
  userMessage: string,
): LlmMessage[] {
  const systemParts = [REFINEMENT_SYSTEM_PROMPT, `=== IDEA ===\n${ideaBrief(idea)}`];
  if (research) systemParts.push(`=== RESEARCH FINDINGS ===\n${researchBlock(research)}`);

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    ...history.map((t) => ({ role: ROLE_MAP[t.role], content: t.content })),
    { role: 'user', content: userMessage },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.context.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.context.ts apps/api/src/modules/refinement/refinement.context.spec.ts
git commit -m "feat(api): refinement LLM context builder"
```

---

## Task 5: Service — thread list, message mapper, research summary loader

**Files:**
- Create: `apps/api/src/modules/refinement/refinement.service.ts`
- Test: `apps/api/src/modules/refinement/refinement.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`; `LlmRegistry` from `../providers/llm/llm.registry`; `AppConfigService`; `IdeasService` from `../ideas/ideas.service`; context/prompt/summary types from Tasks 3–4; shared schemas `VerdictSchema`, `CompetitorMapSchema` and type `RefinementMessageResponse`, `ProposedPatch` from `@ideascout/shared`.
- Produces (this task):
  - `class RefinementService` with constructor `(prisma, config, llm: LlmRegistry, ideas: IdeasService)`
  - `toMessageResponse(msg: RefinementMessage): RefinementMessageResponse`
  - `listThread(projectId: string, ideaId: string): Promise<RefinementMessageResponse[]>`
  - `private loadResearchSummary(ideaId: string): Promise<ResearchSummary | null>`
  - `private loadIdeaOrThrow(projectId, ideaId)` returning the idea with `currentVersion` (throws `NotFoundException`)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/refinement/refinement.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AppConfigService } from '../../config/config.service';
import type { LlmRegistry } from '../providers/llm/llm.registry';
import type { IdeasService } from '../ideas/ideas.service';
import { RefinementService } from './refinement.service';

function makeService(over: {
  message?: unknown[];
  idea?: unknown;
  run?: unknown;
} = {}) {
  const prisma = {
    refinementMessage: {
      findMany: jest.fn().mockResolvedValue(over.message ?? []),
    },
    idea: {
      findUnique: jest.fn().mockResolvedValue(
        over.idea ?? {
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        },
      ),
    },
    researchRun: { findFirst: jest.fn().mockResolvedValue(over.run ?? null) },
  } as unknown as PrismaService;
  const config = { llm: { defaultProvider: 'mock', defaultModel: undefined } } as unknown as AppConfigService;
  const llm = { resolve: jest.fn() } as unknown as LlmRegistry;
  const ideas = { update: jest.fn() } as unknown as IdeasService;
  return { service: new RefinementService(prisma, config, llm, ideas), prisma };
}

describe('RefinementService.listThread', () => {
  it('returns mapped messages oldest-first', async () => {
    const row = {
      id: 'm1',
      ideaId: 'idea1',
      role: 'USER',
      content: 'hi',
      proposedPatch: null,
      appliedVersionId: null,
      createdAt: new Date('2026-07-01T00:00:00Z'),
    };
    const { service, prisma } = makeService({ message: [row] });
    const out = await service.listThread('proj1', 'idea1');
    expect(out).toEqual([
      {
        id: 'm1',
        role: 'USER',
        content: 'hi',
        proposedPatch: null,
        appliedVersionId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    expect((prisma.refinementMessage.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { ideaId: 'idea1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('404s when the idea is not in the project', async () => {
    const { service } = makeService({ idea: { id: 'idea1', projectId: 'OTHER' } });
    await expect(service.listThread('proj1', 'idea1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.service.spec.ts`
Expected: FAIL — cannot find module `./refinement.service`.

- [ ] **Step 3: Implement the service (list + helpers)**

Create `apps/api/src/modules/refinement/refinement.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { RefinementMessage } from '@prisma/client';
import {
  CompetitorMapSchema,
  type ProposedPatch,
  type RefinementMessageResponse,
  VerdictSchema,
} from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import { LlmRegistry } from '../providers/llm/llm.registry';
import { IdeasService } from '../ideas/ideas.service';
import type { ResearchSummary } from './refinement.context';

type IdeaWithVersion = {
  id: string;
  projectId: string;
  currentVersion: { problem: string; solution: string; targetCustomer: string | null } | null;
};

@Injectable()
export class RefinementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly llm: LlmRegistry,
    private readonly ideas: IdeasService,
  ) {}

  /** Prisma row → API DTO (ISO timestamp, patch coerced to the shared shape or null). */
  toMessageResponse(msg: RefinementMessage): RefinementMessageResponse {
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      proposedPatch: (msg.proposedPatch as ProposedPatch | null) ?? null,
      appliedVersionId: msg.appliedVersionId ?? null,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  async listThread(projectId: string, ideaId: string): Promise<RefinementMessageResponse[]> {
    await this.loadIdeaOrThrow(projectId, ideaId);
    const rows = await this.prisma.refinementMessage.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toMessageResponse(r));
  }

  /** Load the idea + current version, asserting it belongs to the (authorized) project. */
  private async loadIdeaOrThrow(projectId: string, ideaId: string): Promise<IdeaWithVersion> {
    const idea = (await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: { currentVersion: true },
    })) as IdeaWithVersion | null;
    if (!idea || idea.projectId !== projectId) {
      throw new NotFoundException('Idea not found');
    }
    return idea;
  }

  /** Summarize the most recent SUCCEEDED research run for the idea (null if none). */
  private async loadResearchSummary(ideaId: string): Promise<ResearchSummary | null> {
    const run = await this.prisma.researchRun.findFirst({
      where: { ideaId, status: 'SUCCEEDED' },
      orderBy: { finishedAt: 'desc' },
      include: {
        moat: true,
        artifacts: {
          where: { kind: { in: ['VERDICT', 'COMPETITOR_MAP'] } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!run) return null;

    const verdictPayload = run.artifacts.find((a) => a.kind === 'VERDICT')?.payload;
    const verdict = VerdictSchema.safeParse(verdictPayload);
    const competitorPayload = run.artifacts.find((a) => a.kind === 'COMPETITOR_MAP')?.payload;
    const competitor = CompetitorMapSchema.safeParse(competitorPayload);

    return {
      verdict: run.verdict ?? (verdict.success ? verdict.data.verdict : 'UNKNOWN'),
      score: run.verdictScore ?? null,
      keyRisks: verdict.success ? verdict.data.keyRisks : [],
      marketSummary: competitor.success ? competitor.data.marketSummary : undefined,
      moatSummary: run.moat?.summary ?? undefined,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.service.ts apps/api/src/modules/refinement/refinement.service.spec.ts
git commit -m "feat(api): refinement service — thread list + research summary"
```

---

## Task 6: Service — streamed message generation

**Files:**
- Modify: `apps/api/src/modules/refinement/refinement.service.ts` (add `generate`)
- Test: `apps/api/src/modules/refinement/refinement.service.spec.ts` (add a describe block)

**Interfaces:**
- Consumes: everything from Task 5; `buildRefinementContext`, `HistoryTurn` from `./refinement.context`; `ideaBrief`, `patchExtractionMessages`, `PatchExtractionSchema` from `./refinement.prompt`; `RefinementStreamEvent` from `@ideascout/shared`.
- Produces: `generate(projectId: string, ideaId: string, content: string): AsyncGenerator<RefinementStreamEvent>` — yields `token` frames while streaming, persists USER (before) and ASSISTANT (after) messages, extracts a patch, then yields one terminal `message` frame; on error yields one `error` frame (assistant message not persisted).

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/modules/refinement/refinement.service.spec.ts`. First extend `makeService` to accept an `llm` stub and wire message creation. Add a new describe:

```ts
describe('RefinementService.generate', () => {
  function collect(gen: AsyncIterable<{ type: string; delta?: string }>) {
    return (async () => {
      const events = [];
      for await (const e of gen) events.push(e);
      return events;
    })();
  }

  it('persists the user message, streams tokens, then persists + emits the assistant message', async () => {
    const created: Record<string, unknown>[] = [];
    const prisma = {
      idea: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        }),
      },
      researchRun: { findFirst: jest.fn().mockResolvedValue(null) },
      refinementMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: `m${created.length + 1}`,
            proposedPatch: null,
            appliedVersionId: null,
            createdAt: new Date('2026-07-01T00:00:00Z'),
            ...data,
          };
          created.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'm2',
            role: 'ASSISTANT',
            content: 'Hello there',
            appliedVersionId: null,
            createdAt: new Date('2026-07-01T00:00:00Z'),
            ...data,
          }),
        ),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;

    async function* fakeStream() {
      yield { delta: 'Hello ', done: false };
      yield { delta: 'there', done: false };
      yield { delta: '', done: true };
    }
    const provider = {
      defaultModel: 'mock-1',
      stream: jest.fn().mockReturnValue(fakeStream()),
      structured: jest.fn().mockResolvedValue({ value: {}, usage: {}, model: 'mock-1' }),
    };
    const config = { llm: { defaultProvider: 'mock', defaultModel: undefined } } as unknown as import('../../config/config.service').AppConfigService;
    const llm = { resolve: jest.fn().mockReturnValue(provider) } as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = { update: jest.fn() } as unknown as import('../ideas/ideas.service').IdeasService;

    const service = new RefinementService(prisma, config, llm, ideas);
    const events = await collect(service.generate('proj1', 'idea1', 'hi'));

    const tokens = events.filter((e) => e.type === 'token').map((e) => e.delta);
    expect(tokens).toEqual(['Hello ', 'there']);
    const terminal = events.at(-1) as { type: string; message: { role: string; content: string } };
    expect(terminal.type).toBe('message');
    expect(terminal.message.role).toBe('ASSISTANT');
    expect(terminal.message.content).toBe('Hello there');

    // user message persisted first, assistant persisted after streaming
    expect((prisma.refinementMessage.create as jest.Mock).mock.calls[0][0].data.role).toBe('USER');
    expect((prisma.refinementMessage.create as jest.Mock).mock.calls[1][0].data.role).toBe('ASSISTANT');
  });

  it('emits an error frame when streaming throws', async () => {
    const prisma = {
      idea: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        }),
      },
      researchRun: { findFirst: jest.fn().mockResolvedValue(null) },
      refinementMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'm1',
          role: 'USER',
          content: 'hi',
          proposedPatch: null,
          appliedVersionId: null,
          createdAt: new Date(),
        }),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;
    async function* boom() {
      yield { delta: 'x', done: false };
      throw new Error('stream died');
    }
    const provider = { defaultModel: 'mock-1', stream: jest.fn().mockReturnValue(boom()) };
    const config = { llm: { defaultProvider: 'mock', defaultModel: undefined } } as unknown as import('../../config/config.service').AppConfigService;
    const llm = { resolve: jest.fn().mockReturnValue(provider) } as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = {} as unknown as import('../ideas/ideas.service').IdeasService;

    const service = new RefinementService(prisma, config, llm, ideas);
    const events = [];
    for await (const e of service.generate('proj1', 'idea1', 'hi')) events.push(e);
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.service.spec.ts -t "generate"`
Expected: FAIL — `service.generate is not a function`.

- [ ] **Step 3: Implement `generate`**

Add these imports to the top of `refinement.service.ts`:

```ts
import type { RefinementStreamEvent } from '@ideascout/shared';
import { buildRefinementContext, ideaBrief, type HistoryTurn } from './refinement.context';
import { PatchExtractionSchema, patchExtractionMessages } from './refinement.prompt';
```

Add a private provider-resolution helper and the `generate` generator to the class:

```ts
  /** Resolve the LLM provider + model for an idea's project (project default → global). */
  private async resolveLlm(projectId: string): Promise<{ provider: ReturnType<LlmRegistry['resolve']>; model: string | undefined }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const provider = this.llm.resolve(project?.llmProvider ?? this.config.llm.defaultProvider);
    const model = project?.llmModel ?? this.config.llm.defaultModel ?? provider.defaultModel;
    return { provider, model };
  }

  /**
   * Generate the advisor's reply for a new user message. Persists the user message, then
   * streams the reply as `token` frames; on completion persists the assistant message,
   * extracts an optional patch, and yields a terminal `message` frame. Any failure yields
   * a single `error` frame (the assistant message is not persisted).
   */
  async *generate(
    projectId: string,
    ideaId: string,
    content: string,
  ): AsyncGenerator<RefinementStreamEvent> {
    const idea = await this.loadIdeaOrThrow(projectId, ideaId);
    if (!idea.currentVersion) {
      throw new NotFoundException('Idea has no current version');
    }

    // Persist the user turn before generating (so the thread records the question).
    await this.prisma.refinementMessage.create({
      data: { ideaId, role: 'USER', content },
    });

    try {
      const [research, history, { provider, model }] = await Promise.all([
        this.loadResearchSummary(ideaId),
        this.loadHistory(ideaId),
        this.resolveLlm(projectId),
      ]);

      const messages = buildRefinementContext(idea.currentVersion, research, history, content);

      let reply = '';
      for await (const chunk of provider.stream(messages, { model })) {
        if (chunk.delta) {
          reply += chunk.delta;
          yield { type: 'token', delta: chunk.delta };
        }
      }

      const patch = await this.extractPatch(provider, model, idea.currentVersion, reply);
      const saved = await this.prisma.refinementMessage.create({
        data: {
          ideaId,
          role: 'ASSISTANT',
          content: reply,
          proposedPatch: (patch as import('@prisma/client').Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });
      yield { type: 'message', message: this.toMessageResponse(saved) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message };
    }
  }

  /** Prior turns (excluding SYSTEM) as history for the context builder. */
  private async loadHistory(ideaId: string): Promise<HistoryTurn[]> {
    const rows = await this.prisma.refinementMessage.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((r) => r.role === 'USER' || r.role === 'ASSISTANT')
      .map((r) => ({ role: r.role as HistoryTurn['role'], content: r.content }));
  }

  /** Second (structured) call: extract an idea patch from the reply; null if empty. */
  private async extractPatch(
    provider: ReturnType<LlmRegistry['resolve']>,
    model: string | undefined,
    version: { problem: string; solution: string; targetCustomer: string | null },
    reply: string,
  ): Promise<ProposedPatch | null> {
    const { value } = await provider.structured(
      patchExtractionMessages(ideaBrief(version), reply),
      PatchExtractionSchema,
      { model, schemaName: 'PatchExtraction' },
    );
    const patch: ProposedPatch = {};
    if (value.problem) patch.problem = value.problem;
    if (value.solution) patch.solution = value.solution;
    if (value.targetCustomer) patch.targetCustomer = value.targetCustomer;
    return Object.keys(patch).length > 0 ? patch : null;
  }
```

> Note: the `loadHistory` query runs BEFORE the assistant message is created, and AFTER the user message is created — so history includes the just-posted user turn. That's fine: `buildRefinementContext` appends `content` as the final user turn, and the mock/real models tolerate the mild duplication. To avoid it, `loadHistory` excludes the newest USER row: change the filter to drop the last message if it equals the just-created user turn. For simplicity and determinism we keep the duplication out by having `generate` pass `history` that excludes the current turn — see Step 4 adjustment.

- [ ] **Step 4: Adjust `loadHistory` to exclude the current turn**

To keep the just-posted user message from appearing twice (once as history, once as the final turn), capture the created user message id and filter it out. Update `generate` to pass the created id and `loadHistory` to exclude it:

In `generate`, change the user-create to capture the row and pass its id:

```ts
    const userMsg = await this.prisma.refinementMessage.create({
      data: { ideaId, role: 'USER', content },
    });
```

and change the history load call to:

```ts
        this.loadHistory(ideaId, userMsg.id),
```

Update `loadHistory` signature/body:

```ts
  private async loadHistory(ideaId: string, excludeId?: string): Promise<HistoryTurn[]> {
    const rows = await this.prisma.refinementMessage.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((r) => r.id !== excludeId && (r.role === 'USER' || r.role === 'ASSISTANT'))
      .map((r) => ({ role: r.role as HistoryTurn['role'], content: r.content }));
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.service.spec.ts`
Expected: PASS (Task 5 + Task 6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.service.ts apps/api/src/modules/refinement/refinement.service.spec.ts
git commit -m "feat(api): refinement service — streamed advisor generation + patch extraction"
```

---

## Task 7: Service — apply patch

**Files:**
- Modify: `apps/api/src/modules/refinement/refinement.service.ts` (add `applyPatch`)
- Test: `apps/api/src/modules/refinement/refinement.service.spec.ts` (add a describe block)

**Interfaces:**
- Consumes: `IdeasService.update(projectId, ideaId, dto)` (creates a new version, returns `IdeaWithVersion`); `BadRequestException`.
- Produces: `applyPatch(projectId: string, ideaId: string, messageId: string): Promise<IdeaWithVersion>` where `IdeaWithVersion` is `IdeasService`'s return type — creates a new idea version from the message's `proposedPatch`, sets the message's `appliedVersionId`, returns the updated idea.

- [ ] **Step 1: Write the failing test**

Add to `refinement.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

describe('RefinementService.applyPatch', () => {
  function base(messageRow: unknown) {
    const prisma = {
      idea: {
        findUnique: jest.fn().mockResolvedValue({ id: 'idea1', projectId: 'proj1', currentVersion: {} }),
      },
      refinementMessage: {
        findUnique: jest.fn().mockResolvedValue(messageRow),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;
    const config = {} as unknown as import('../../config/config.service').AppConfigService;
    const llm = {} as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = {
      update: jest.fn().mockResolvedValue({ id: 'idea1', currentVersionId: 'v2', currentVersion: { id: 'v2' } }),
    } as unknown as import('../ideas/ideas.service').IdeasService;
    return { service: new RefinementService(prisma, config, llm, ideas), prisma, ideas };
  }

  it('creates a new version from the patch and links appliedVersionId', async () => {
    const { service, prisma, ideas } = base({
      id: 'm2',
      ideaId: 'idea1',
      proposedPatch: { problem: 'sharper problem' },
      appliedVersionId: null,
    });
    const result = await service.applyPatch('proj1', 'idea1', 'm2');
    expect((ideas.update as jest.Mock)).toHaveBeenCalledWith('proj1', 'idea1', { problem: 'sharper problem' });
    expect((prisma.refinementMessage.update as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 'm2' },
      data: { appliedVersionId: 'v2' },
    });
    expect(result.currentVersionId).toBe('v2');
  });

  it('rejects a message with no proposed patch', async () => {
    const { service } = base({ id: 'm3', ideaId: 'idea1', proposedPatch: null, appliedVersionId: null });
    await expect(service.applyPatch('proj1', 'idea1', 'm3')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an already-applied message', async () => {
    const { service } = base({ id: 'm2', ideaId: 'idea1', proposedPatch: { problem: 'x' }, appliedVersionId: 'v9' });
    await expect(service.applyPatch('proj1', 'idea1', 'm2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when the message belongs to another idea', async () => {
    const { service } = base({ id: 'm2', ideaId: 'OTHER', proposedPatch: { problem: 'x' }, appliedVersionId: null });
    await expect(service.applyPatch('proj1', 'idea1', 'm2')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.service.spec.ts -t "applyPatch"`
Expected: FAIL — `service.applyPatch is not a function`.

- [ ] **Step 3: Implement `applyPatch`**

Add `BadRequestException` to the `@nestjs/common` import, and add the method to the class:

```ts
  /** Apply a message's proposed patch → new idea version; link it back to the message. */
  async applyPatch(
    projectId: string,
    ideaId: string,
    messageId: string,
  ): Promise<Awaited<ReturnType<IdeasService['update']>>> {
    await this.loadIdeaOrThrow(projectId, ideaId);
    const message = await this.prisma.refinementMessage.findUnique({ where: { id: messageId } });
    if (!message || message.ideaId !== ideaId) {
      throw new NotFoundException('Refinement message not found');
    }
    const patch = message.proposedPatch as ProposedPatch | null;
    if (!patch || Object.keys(patch).length === 0) {
      throw new BadRequestException('Message has no proposed patch to apply');
    }
    if (message.appliedVersionId) {
      throw new BadRequestException('Patch has already been applied');
    }

    const updated = await this.ideas.update(projectId, ideaId, {
      problem: patch.problem,
      solution: patch.solution,
      targetCustomer: patch.targetCustomer,
      attributes: patch.attributes,
    });
    await this.prisma.refinementMessage.update({
      where: { id: messageId },
      data: { appliedVersionId: updated.currentVersionId },
    });
    return updated;
  }
```

> Note: `IdeasService.update` expects an `UpdateIdeaRequest` (`{ title?, problem?, solution?, targetCustomer?, attributes? }`) and merges undefined fields with the current version — so passing only the patch's fields is correct. `updated.currentVersionId` is the new version's id.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.service.spec.ts`
Expected: PASS (all service tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.service.ts apps/api/src/modules/refinement/refinement.service.spec.ts
git commit -m "feat(api): refinement service — apply proposed patch to a new idea version"
```

---

## Task 8: Controller (thread, SSE stream, apply) + Swagger

**Files:**
- Create: `apps/api/src/modules/refinement/refinement.controller.ts`
- Test: `apps/api/src/modules/refinement/refinement.controller.spec.ts`

**Interfaces:**
- Consumes: `RefinementService` (Tasks 5–7); `PostRefinementMessageRequestSchema`, `RefinementMessageResponseSchema` from `@ideascout/shared`; `ZodValidationPipe`, `ApiZodBody`, guards.
- Produces: `RefinementController` with routes under `projects/:projectId/ideas/:ideaId/refine`:
  - `GET  ''` → `RefinementMessageResponse[]`
  - `POST '' ` (body `{content}`) → writes SSE frames to the Express `Response`
  - `POST ':messageId/apply'` → updated idea

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/refinement/refinement.controller.spec.ts`:

```ts
import type { Response } from 'express';
import type { RefinementService } from './refinement.service';
import { RefinementController } from './refinement.controller';

function makeRes() {
  const writes: string[] = [];
  const res = {
    setHeader: jest.fn(),
    write: jest.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    end: jest.fn(),
    flushHeaders: jest.fn(),
  } as unknown as Response;
  return { res, writes };
}

describe('RefinementController', () => {
  it('GET returns the thread', async () => {
    const service = { listThread: jest.fn().mockResolvedValue([{ id: 'm1' }]) } as unknown as RefinementService;
    const controller = new RefinementController(service);
    expect(await controller.thread('proj1', 'idea1')).toEqual([{ id: 'm1' }]);
    expect(service.listThread).toHaveBeenCalledWith('proj1', 'idea1');
  });

  it('POST writes each event as an SSE frame then ends', async () => {
    async function* gen() {
      yield { type: 'token', delta: 'Hi' };
      yield { type: 'message', message: { id: 'm2' } };
    }
    const service = { generate: jest.fn().mockReturnValue(gen()) } as unknown as RefinementService;
    const controller = new RefinementController(service);
    const { res, writes } = makeRes();

    await controller.stream('proj1', 'idea1', { content: 'hello' }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(writes[0]).toBe(`data: ${JSON.stringify({ type: 'token', delta: 'Hi' })}\n\n`);
    expect(writes[1]).toBe(`data: ${JSON.stringify({ type: 'message', message: { id: 'm2' } })}\n\n`);
    expect(res.end).toHaveBeenCalled();
  });

  it('POST apply delegates to the service', async () => {
    const service = { applyPatch: jest.fn().mockResolvedValue({ id: 'idea1' }) } as unknown as RefinementService;
    const controller = new RefinementController(service);
    expect(await controller.apply('proj1', 'idea1', 'm2')).toEqual({ id: 'idea1' });
    expect(service.applyPatch).toHaveBeenCalledWith('proj1', 'idea1', 'm2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.controller.spec.ts`
Expected: FAIL — cannot find module `./refinement.controller`.

- [ ] **Step 3: Implement the controller**

Create `apps/api/src/modules/refinement/refinement.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  type PostRefinementMessageRequest,
  PostRefinementMessageRequestSchema,
  type RefinementMessageResponse,
} from '@ideascout/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ProjectAccessGuard } from '../projects/project-access.guard';
import { RefinementService } from './refinement.service';

@ApiTags('refinement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/ideas/:ideaId/refine')
export class RefinementController {
  constructor(private readonly refinement: RefinementService) {}

  @Get()
  @ApiOperation({ summary: 'List the refinement conversation for an idea' })
  thread(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
  ): Promise<RefinementMessageResponse[]> {
    return this.refinement.listThread(projectId, ideaId);
  }

  @Post()
  @ApiOperation({ summary: 'Post a refinement message; streams the advisor reply as SSE' })
  @ApiZodBody(PostRefinementMessageRequestSchema)
  async stream(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(PostRefinementMessageRequestSchema)) dto: PostRefinementMessageRequest,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    for await (const event of this.refinement.generate(projectId, ideaId, dto.content)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }

  @Post(':messageId/apply')
  @ApiOperation({ summary: 'Apply a proposed patch, creating a new idea version' })
  apply(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.refinement.applyPatch(projectId, ideaId, messageId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/refinement/refinement.controller.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.controller.ts apps/api/src/modules/refinement/refinement.controller.spec.ts
git commit -m "feat(api): refinement controller — thread, SSE stream, apply"
```

---

## Task 9: Module wiring + full verification

**Files:**
- Create: `apps/api/src/modules/refinement/refinement.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `RefinementModule`)
- Delete: `apps/api/src/modules/refinement/.gitkeep` (folder now has real files)

**Interfaces:**
- Consumes: `RefinementController`, `RefinementService`, `ProjectsModule` (for `ProjectAccessGuard` deps), `IdeasModule` (exports `IdeasService`), `PrismaModule`. `LlmRegistry` is provided by the `@Global` `ProvidersModule`.
- Produces: `RefinementModule`.

> Precondition: confirm `IdeasModule` exports `IdeasService`. If it does not, add `exports: [IdeasService]` to `apps/api/src/modules/ideas/ideas.module.ts` as part of this task (Step 2).

- [ ] **Step 1: Create the module**

Create `apps/api/src/modules/refinement/refinement.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { IdeasModule } from '../ideas/ideas.module';
import { RefinementController } from './refinement.controller';
import { RefinementService } from './refinement.service';

@Module({
  imports: [ProjectsModule, IdeasModule], // ProjectAccessGuard deps + IdeasService for versioning
  controllers: [RefinementController],
  providers: [RefinementService],
})
export class RefinementModule {}
```

- [ ] **Step 2: Ensure `IdeasModule` exports `IdeasService`**

Run: `grep -n "exports" apps/api/src/modules/ideas/ideas.module.ts`
If `IdeasService` is not exported, edit `apps/api/src/modules/ideas/ideas.module.ts` to add/extend:

```ts
  exports: [IdeasService],
```

- [ ] **Step 3: Register in `app.module.ts`**

In `apps/api/src/app.module.ts`, add the import and place `RefinementModule` in the `imports` array right after `ResearchModule`:

```ts
import { RefinementModule } from './modules/refinement/refinement.module';
```

```ts
    ResearchModule,
    RefinementModule,
```

Also remove the now-stale comment `// Refinement is the remaining feature module (next milestone).` above `@Module` if present.

- [ ] **Step 4: Remove the stub**

Run: `git rm apps/api/src/modules/refinement/.gitkeep`

- [ ] **Step 5: Typecheck, lint, and run the full API suite**

Run:
```bash
cd /Users/base/Projects/ideascout && npm run typecheck && npm run lint && npx prettier --check "apps/api/src/modules/refinement/**/*.ts"
cd apps/api && npx jest
```
Expected: typecheck PASS (all workspaces), lint PASS, prettier clean, all Jest suites PASS (including `app.module.spec.ts`, which boots the DI container and now resolves `RefinementModule`). If prettier flags files, run `npx prettier --write "apps/api/src/modules/refinement/**/*.ts"` and re-run.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/refinement/refinement.module.ts apps/api/src/app.module.ts apps/api/src/modules/ideas/ideas.module.ts
git rm --cached apps/api/src/modules/refinement/.gitkeep 2>/dev/null || true
git commit -m "feat(api): wire RefinementModule into the app"
```

---

## Task 10: Docs — update CLAUDE.md roadmap note

**Files:**
- Modify: `CLAUDE.md` (refinement module now exists)

- [ ] **Step 1: Update the module-layout description**

In `CLAUDE.md`, the module list mentions research; add a short note that `src/modules/refinement/*` implements the streamed advisor loop. Find the `apps/api` bullet under "Monorepo layout" and append to its sentence (or add a line):

```
Refinement (`src/modules/refinement/*`) adds the streamed AI-advisor loop:
POST returns an SSE token stream; the advisor can propose idea-version patches.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note the refinement module in CLAUDE.md"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Streamed SSE reply → Tasks 1, 6, 8. Two-phase reply-then-patch → Task 6 (`generate` + `extractPatch`). Context (idea + history + research summary) → Tasks 4, 5, 6. Apply = version + link → Task 7. Single streaming POST → Task 8. OpenAI-only real streaming → Task 2. Swagger → Task 8. Testing/mock-first → every task. No schema changes → confirmed (uses existing `RefinementMessage` + DTOs). ✅
- Non-goals honored: no lifecycle auto-transition / auto-re-research (Task 7 only versions + links); no store-interface seam (service uses `PrismaService`); Anthropic/Gemini left emit-once (Task 2, Step 5). ✅

**Placeholder scan:** No TBD/TODO in requirements; the only `TODO(streaming)` is an intentional in-code marker (Task 2). All code steps show full code. ✅

**Type consistency:** `RefinementStreamEvent` (Task 1) consumed in Tasks 6/8. `ResearchSummary`/`HistoryTurn`/`IdeaSnapshot` defined in Task 4, used in Tasks 5/6. `toMessageResponse`/`loadIdeaOrThrow`/`loadResearchSummary` defined Task 5, used Tasks 6/7. `resolveLlm`/`loadHistory`/`extractPatch` defined Task 6. `applyPatch` uses `IdeasService.update` return (`currentVersionId`). Controller method names `thread`/`stream`/`apply` match their specs. ✅
