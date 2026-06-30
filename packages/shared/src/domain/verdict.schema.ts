import { z } from 'zod';
import { VERDICTS } from '../enums';
import { CitationSchema } from './citation.schema';

/** A single weighted reason feeding the overall verdict. */
export const VerdictReasonSchema = z.object({
  claim: z.string().min(1),
  impact: z.enum(['positive', 'negative', 'neutral']),
  weight: z.number().min(0).max(1),
});

/** The final GO / NO-GO recommendation produced by the research pipeline. */
export const VerdictSchema = z.object({
  verdict: z.enum(VERDICTS),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  reasons: z.array(VerdictReasonSchema).min(1),
  keyRisks: z.array(z.string()),
  conditions: z.array(z.string()).default([]),
  citations: z.array(CitationSchema),
});

export type VerdictReason = z.infer<typeof VerdictReasonSchema>;
export type VerdictResult = z.infer<typeof VerdictSchema>;
