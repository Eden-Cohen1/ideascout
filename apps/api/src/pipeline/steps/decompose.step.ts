import { Injectable } from '@nestjs/common';
import type { PipelineStep, ResearchContext, StepResult } from '../pipeline.types';
import { ResearchQuestionsSchema } from '../schemas';
import { decomposePrompt } from '../prompts';

/** How many sub-questions we keep to drive market research (bounds search cost). */
const MAX_QUESTIONS = 6;

/**
 * DECOMPOSE — turn the raw idea into a handful of concrete research questions.
 * LLM-only (no web yet); output feeds the MARKET_RESEARCH search step.
 */
@Injectable()
export class DecomposeStep implements PipelineStep {
  readonly step = 'DECOMPOSE' as const;

  async execute(ctx: ResearchContext): Promise<StepResult> {
    const { value } = await ctx.llm.structured(decomposePrompt(ctx.idea), ResearchQuestionsSchema, {
      model: ctx.run.llmModel,
      signal: ctx.signal,
      schemaName: 'ResearchQuestions',
    });
    ctx.questions = value.questions.slice(0, MAX_QUESTIONS);
    return { artifacts: [{ kind: 'LLM_RAW', payload: { questions: ctx.questions } }] };
  }
}
