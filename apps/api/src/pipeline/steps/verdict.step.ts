import { Injectable } from '@nestjs/common';
import { VerdictSchema } from '@ideascout/shared';
import type { PipelineStep, ResearchContext, StepResult } from '../pipeline.types';
import { verdictPrompt } from '../prompts';
import { groundCitations } from '../citation-grounding';

/**
 * VERDICT — the final GO / NO_GO / CONDITIONAL_GO call, grounded in the corpus and
 * the analysis accumulated in context. The orchestrator promotes its verdict + score
 * onto the run record.
 */
@Injectable()
export class VerdictStep implements PipelineStep {
  readonly step = 'VERDICT' as const;

  async execute(ctx: ResearchContext): Promise<StepResult> {
    const { value } = await ctx.llm.structured(verdictPrompt(ctx.idea, ctx.pages), VerdictSchema, {
      model: ctx.run.llmModel,
      signal: ctx.signal,
      schemaName: 'Verdict',
    });

    value.citations = groundCitations(value.citations, ctx.pages);
    ctx.verdict = value;

    return { artifacts: [{ kind: 'VERDICT', payload: value }] };
  }
}
