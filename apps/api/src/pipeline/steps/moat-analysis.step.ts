import { Injectable } from '@nestjs/common';
import { MoatSchema } from '@ideascout/shared';
import type { PipelineStep, ResearchContext, StepResult } from '../pipeline.types';
import { moatPrompt } from '../prompts';
import { groundCitations } from '../citation-grounding';

/**
 * MOAT_ANALYSIS — score the idea's defensibility across the standard moat dimensions,
 * grounded in the corpus.
 */
@Injectable()
export class MoatAnalysisStep implements PipelineStep {
  readonly step = 'MOAT_ANALYSIS' as const;

  async execute(ctx: ResearchContext): Promise<StepResult> {
    const { value } = await ctx.llm.structured(moatPrompt(ctx.idea, ctx.pages), MoatSchema, {
      model: ctx.run.llmModel,
      signal: ctx.signal,
      schemaName: 'Moat',
    });

    value.citations = groundCitations(value.citations, ctx.pages);
    ctx.moat = value;

    return { artifacts: [{ kind: 'MOAT', payload: value }] };
  }
}
