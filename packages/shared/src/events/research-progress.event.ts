import { z } from 'zod';
import { RESEARCH_RUN_STATUSES, RESEARCH_STEPS } from '../enums';

/**
 * Payload streamed over SSE (`GET /api/research/:runId/stream`) as the research
 * pipeline advances. The worker emits one of these per step transition / progress tick.
 */
export const ResearchProgressEventSchema = z.object({
  runId: z.string(),
  status: z.enum(RESEARCH_RUN_STATUSES),
  step: z.enum(RESEARCH_STEPS).nullable(),
  progress: z.number().int().min(0).max(100),
  message: z.string().optional(),
  at: z.string(),
});

export type ResearchProgressEvent = z.infer<typeof ResearchProgressEventSchema>;
