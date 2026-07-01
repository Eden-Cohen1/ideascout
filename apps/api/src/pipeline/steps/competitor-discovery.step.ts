import { Injectable } from '@nestjs/common';
import { CompetitorMapSchema } from '@ideascout/shared';
import type { PipelineStep, ResearchContext, StepResult } from '../pipeline.types';
import { competitorPrompt } from '../prompts';
import { groundCitations } from '../citation-grounding';

/**
 * COMPETITOR_DISCOVERY — extract a competitor map from the corpus. Per-competitor
 * citations are grounded against fetched pages so a competitor can't be "sourced"
 * from a page we never retrieved.
 */
@Injectable()
export class CompetitorDiscoveryStep implements PipelineStep {
  readonly step = 'COMPETITOR_DISCOVERY' as const;

  async execute(ctx: ResearchContext): Promise<StepResult> {
    const { value } = await ctx.llm.structured(
      competitorPrompt(ctx.idea, ctx.pages),
      CompetitorMapSchema,
      { model: ctx.run.llmModel, signal: ctx.signal, schemaName: 'CompetitorMap' },
    );

    for (const competitor of value.competitors) {
      competitor.citations = groundCitations(competitor.citations, ctx.pages);
    }
    ctx.competitorMap = value;

    return { artifacts: [{ kind: 'COMPETITOR_MAP', payload: value }] };
  }
}
