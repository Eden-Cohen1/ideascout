import { RESEARCH_STEPS } from '@ideascout/shared';
import type { ResearchProvider } from '../../modules/providers/research/research-provider.interface';
import type { StepResult } from '../pipeline.types';
import { makeContext } from './test-fixtures';
import { STEP_CLASSES } from './index';
import { DecomposeStep } from './decompose.step';
import { MarketResearchStep } from './market-research.step';
import { CompetitorDiscoveryStep } from './competitor-discovery.step';
import { MoatAnalysisStep } from './moat-analysis.step';
import { VerdictStep } from './verdict.step';

/** Count search hits recorded in a MarketResearchStep's SEARCH_RESULTS artifact. */
function searchResultCount(result: StepResult): number {
  const payload = result.artifacts.find((a) => a.kind === 'SEARCH_RESULTS')?.payload;
  return (payload as { results: unknown[] } | undefined)?.results.length ?? 0;
}

describe('pipeline step ordering', () => {
  it('STEP_CLASSES order matches the RESEARCH_STEPS contract (progress/SSE depend on it)', () => {
    expect(STEP_CLASSES.map((C) => new C().step)).toEqual([...RESEARCH_STEPS]);
  });
});

describe('DecomposeStep', () => {
  it('produces research questions and an LLM_RAW artifact', async () => {
    const ctx = makeContext();
    const result = await new DecomposeStep().execute(ctx);
    expect(ctx.questions.length).toBeGreaterThan(0);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].kind).toBe('LLM_RAW');
  });
});

describe('MarketResearchStep', () => {
  it('searches each question and fetches pages into the corpus', async () => {
    const ctx = makeContext({ questions: ['q1', 'q2'] });
    const result = await new MarketResearchStep().execute(ctx);
    expect(searchResultCount(result)).toBeGreaterThan(0);
    expect(ctx.pages.length).toBeGreaterThan(0);
    expect(ctx.pages.every((p) => p.status === 'ok')).toBe(true);
    expect(result.artifacts.map((a) => a.kind)).toEqual(['SEARCH_RESULTS', 'FETCHED_PAGE']);
  });

  it('falls back to the idea title when there are no questions', async () => {
    const ctx = makeContext({ questions: [] });
    const result = await new MarketResearchStep().execute(ctx);
    expect(searchResultCount(result)).toBeGreaterThan(0);
  });

  it('drops pages that fail to fetch', async () => {
    const blocking: ResearchProvider = {
      id: 'blocking',
      isAvailable: () => true,
      search: async () => [{ title: 't', url: 'https://x.com', snippet: 's', rank: 1 }],
      fetch: async (url) => ({
        url,
        content: '',
        fetchedAt: '1970-01-01T00:00:00.000Z',
        status: 'blocked' as const,
      }),
    };
    const ctx = makeContext({ questions: ['q1'], research: blocking });
    await new MarketResearchStep().execute(ctx);
    expect(ctx.pages).toHaveLength(0);
  });
});

describe('extraction steps ground citations against the fetched corpus', () => {
  // The mock LLM emits a citation to https://example.com/mock, which is NOT a fetched
  // page, so grounding must strip it. Real fetched pages live under example.com/mock/<q>/<n>.
  async function ctxWithCorpus() {
    const ctx = makeContext({ questions: ['demand'] });
    await new MarketResearchStep().execute(ctx);
    return ctx;
  }

  it('CompetitorDiscovery drops ungrounded competitor citations', async () => {
    const ctx = await ctxWithCorpus();
    const result = await new CompetitorDiscoveryStep().execute(ctx);
    expect(ctx.competitorMap).toBeDefined();
    for (const c of ctx.competitorMap!.competitors) {
      expect(c.citations.every((cit) => ctx.pages.some((p) => p.url === cit.url))).toBe(true);
    }
    expect(result.artifacts[0].kind).toBe('COMPETITOR_MAP');
  });

  it('MoatAnalysis grounds its citations', async () => {
    const ctx = await ctxWithCorpus();
    await new MoatAnalysisStep().execute(ctx);
    expect(ctx.moat).toBeDefined();
    expect(ctx.moat!.citations.every((cit) => ctx.pages.some((p) => p.url === cit.url))).toBe(true);
  });

  it('Verdict grounds its citations and sets a verdict', async () => {
    const ctx = await ctxWithCorpus();
    const result = await new VerdictStep().execute(ctx);
    expect(ctx.verdict).toBeDefined();
    expect(['GO', 'NO_GO', 'CONDITIONAL_GO']).toContain(ctx.verdict!.verdict);
    expect(ctx.verdict!.citations.every((cit) => ctx.pages.some((p) => p.url === cit.url))).toBe(
      true,
    );
    expect(result.artifacts[0].kind).toBe('VERDICT');
  });
});
