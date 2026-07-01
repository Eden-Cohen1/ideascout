import { Injectable } from '@nestjs/common';
import type { PipelineStep, ResearchContext, StepResult } from '../pipeline.types';
import type {
  FetchedPage,
  SearchResult,
} from '../../modules/providers/research/research-provider.interface';

/** Bounds that keep a run cheap and predictable. */
const RESULTS_PER_QUERY = 5;
const MAX_PAGES = 8;

/**
 * MARKET_RESEARCH — run each question through the web-research provider, then fetch
 * the top unique pages into the grounding corpus. This is the ONLY step that touches
 * the web; every later step reasons strictly over `ctx.pages`.
 */
@Injectable()
export class MarketResearchStep implements PipelineStep {
  readonly step = 'MARKET_RESEARCH' as const;

  async execute(ctx: ResearchContext): Promise<StepResult> {
    const queries = ctx.questions.length > 0 ? ctx.questions : [ctx.idea.title];

    const results: SearchResult[] = [];
    for (const query of queries) {
      const hits = await ctx.research.search({ query, maxResults: RESULTS_PER_QUERY });
      results.push(...hits);
    }

    // De-dupe by URL, keep best (lowest) rank first, cap the fetch budget.
    const byUrl = new Map<string, SearchResult>();
    for (const r of results) {
      const existing = byUrl.get(r.url);
      if (!existing || r.rank < existing.rank) {
        byUrl.set(r.url, r);
      }
    }
    const toFetch = [...byUrl.values()].sort((a, b) => a.rank - b.rank).slice(0, MAX_PAGES);

    const pages: FetchedPage[] = [];
    for (const result of toFetch) {
      const page = await ctx.research.fetch(result.url);
      if (page.status === 'ok') {
        pages.push(page);
      }
    }
    ctx.pages = pages;

    return {
      artifacts: [
        { kind: 'SEARCH_RESULTS', payload: { queries, results } },
        { kind: 'FETCHED_PAGE', payload: { pages } },
      ],
    };
  }
}
