import type { ResearchProgressEvent, VerdictResult } from '@ideascout/shared';
import { ResearchPipeline } from './research-pipeline';
import type { PipelineStep, ResearchContext, StepResult } from './pipeline.types';
import type { ResearchStore } from './research-store';
import { makeContext } from './steps/test-fixtures';
import { STEP_CLASSES } from './steps';

function recordingStore() {
  const calls: string[] = [];
  let succeededWith: VerdictResult | undefined;
  const store: ResearchStore = {
    markRunning: async () => void calls.push('markRunning'),
    setProgress: async (_r, step) => void calls.push(`progress:${step}`),
    saveArtifact: async (_r, step, a) => void calls.push(`artifact:${step}:${a.kind}`),
    saveCompetitors: async () => void calls.push('saveCompetitors'),
    saveMoat: async () => void calls.push('saveMoat'),
    markSucceeded: async (_r, v) => {
      succeededWith = v;
      calls.push('markSucceeded');
    },
    markFailed: async () => void calls.push('markFailed'),
  };
  return {
    store,
    calls,
    get succeededWith() {
      return succeededWith;
    },
  };
}

const buildSteps = (): PipelineStep[] => STEP_CLASSES.map((C) => new C());

async function collectEvents(
  run: (emit: (e: ResearchProgressEvent) => Promise<void>) => Promise<void>,
) {
  const events: ResearchProgressEvent[] = [];
  await run(async (e) => void events.push(e));
  return events;
}

describe('ResearchPipeline', () => {
  it('runs every step in order, persists, and succeeds with a verdict', async () => {
    const rec = recordingStore();
    const { store, calls } = rec;
    const pipeline = new ResearchPipeline(buildSteps(), store);
    const ctx = makeContext();

    const events = await collectEvents((emit) => pipeline.run(ctx, emit));

    expect(calls[0]).toBe('markRunning');
    expect(calls).toContain('saveCompetitors');
    expect(calls).toContain('saveMoat');
    expect(calls.at(-1)).toBe('markSucceeded');
    expect(rec.succeededWith?.verdict).toBe(ctx.verdict?.verdict);

    // progress is monotonic and the final event is SUCCEEDED at 100.
    const progresses = events.map((e) => e.progress);
    expect(progresses).toEqual([...progresses].sort((a, b) => a - b));
    expect(events.at(-1)).toMatchObject({ status: 'SUCCEEDED', progress: 100, step: 'VERDICT' });
  });

  it('emits one RUNNING event per step', async () => {
    const { store } = recordingStore();
    const pipeline = new ResearchPipeline(buildSteps(), store);
    const events = await collectEvents((emit) => pipeline.run(makeContext(), emit));
    const stepEvents = events.filter((e) => e.status === 'RUNNING' && e.step !== null);
    expect(stepEvents.map((e) => e.step)).toEqual([
      'DECOMPOSE',
      'MARKET_RESEARCH',
      'COMPETITOR_DISCOVERY',
      'MOAT_ANALYSIS',
      'VERDICT',
    ]);
  });

  it('pauses stepDelayMs between steps but not after the last one', async () => {
    const { store } = recordingStore();
    const delays: number[] = [];
    const realSetTimeout = global.setTimeout;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      delays.push(ms ?? 0);
      return realSetTimeout(fn, 0);
    }) as typeof setTimeout);

    try {
      const pipeline = new ResearchPipeline(buildSteps(), store);
      await collectEvents((emit) => pipeline.run(makeContext({ stepDelayMs: 25 }), emit));
    } finally {
      spy.mockRestore();
    }

    // 5 steps => 4 inter-step pauses, all at the configured delay.
    expect(delays).toEqual([25, 25, 25, 25]);
  });

  it('marks the run failed and rethrows when a step throws', async () => {
    const { store, calls } = recordingStore();
    const boom: PipelineStep = {
      step: 'DECOMPOSE',
      execute: async (): Promise<StepResult> => {
        throw new Error('kaboom');
      },
    };
    const pipeline = new ResearchPipeline([boom], store);

    await expect(pipeline.run(makeContext(), async () => {})).rejects.toThrow('kaboom');
    expect(calls).toContain('markFailed');
    expect(calls).not.toContain('markSucceeded');
  });

  it('aborts before running a step when the signal is already aborted', async () => {
    const { store, calls } = recordingStore();
    const controller = new AbortController();
    controller.abort();
    const ctx: ResearchContext = makeContext({ signal: controller.signal });
    const pipeline = new ResearchPipeline(buildSteps(), store);

    await expect(pipeline.run(ctx, async () => {})).rejects.toThrow('cancelled');
    expect(calls).toContain('markFailed');
    expect(calls.some((c) => c.startsWith('artifact:'))).toBe(false);
  });
});
