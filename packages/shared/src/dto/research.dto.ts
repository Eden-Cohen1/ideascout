import { z } from 'zod';
import { RESEARCH_RUN_STATUSES, RESEARCH_STEPS, VERDICTS } from '../enums';
import { ProviderSelectionSchema } from './project.dto';
import { VerdictSchema } from '../domain/verdict.schema';
import { CompetitorMapSchema } from '../domain/competitor.schema';
import { MoatSchema } from '../domain/moat.schema';

/** Optional per-run provider override; empty body uses project/global defaults. */
export const StartResearchRequestSchema = ProviderSelectionSchema;

export const ResearchRunSummarySchema = z.object({
  id: z.string(),
  ideaId: z.string(),
  ideaVersionId: z.string(),
  status: z.enum(RESEARCH_RUN_STATUSES),
  currentStep: z.enum(RESEARCH_STEPS).nullable().optional(),
  progress: z.number().int().min(0).max(100),
  verdict: z.enum(VERDICTS).nullable().optional(),
  verdictScore: z.number().int().min(0).max(100).nullable().optional(),
  llmProvider: z.string(),
  llmModel: z.string(),
  researchProvider: z.string(),
  error: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const ResearchRunDetailSchema = ResearchRunSummarySchema.extend({
  verdictResult: VerdictSchema.nullable().optional(),
  competitorMap: CompetitorMapSchema.nullable().optional(),
  moat: MoatSchema.nullable().optional(),
});

export type StartResearchRequest = z.infer<typeof StartResearchRequestSchema>;
export type ResearchRunSummary = z.infer<typeof ResearchRunSummarySchema>;
export type ResearchRunDetail = z.infer<typeof ResearchRunDetailSchema>;
