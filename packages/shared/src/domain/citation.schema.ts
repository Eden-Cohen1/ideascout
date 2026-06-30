import { z } from 'zod';

/**
 * A source citation attached to AI-generated research output. Every citation must
 * point at a real fetched page (the research pipeline enforces that the `url` is one
 * actually retrieved during the run — see the citation-grounding step).
 */
export const CitationSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  quote: z.string().max(500).optional(),
});

export type Citation = z.infer<typeof CitationSchema>;
