import { z } from 'zod';
import { CitationSchema } from './citation.schema';

/** One competitor in the market map, with what they sell and who they sell to. */
export const CompetitorSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  product: z.string().min(1),
  customer: z.string().min(1),
  positioning: z.string().optional(),
  pricingNotes: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  citations: z.array(CitationSchema),
});

/** The full competitor map for a research run. */
export const CompetitorMapSchema = z.object({
  competitors: z.array(CompetitorSchema),
  marketSummary: z.string().min(1),
  segments: z.array(z.string()).default([]),
});

export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorMap = z.infer<typeof CompetitorMapSchema>;
