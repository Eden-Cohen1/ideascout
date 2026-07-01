import { z } from 'zod';

/**
 * Internal-only LLM output contracts for the pipeline. Cross-boundary contracts
 * (Competitor/Moat/Verdict — consumed by the API + web) live in @ideascout/shared;
 * these never leave the pipeline, so they stay here to keep shared focused.
 */

/** DECOMPOSE output: the sub-questions that drive market research. */
export const ResearchQuestionsSchema = z.object({
  questions: z.array(z.string().min(1)).min(1).max(8),
});
