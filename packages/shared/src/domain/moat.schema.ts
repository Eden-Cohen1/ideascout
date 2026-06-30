import { z } from 'zod';
import { CitationSchema } from './citation.schema';

/** The classic sources of durable competitive advantage. */
export const MOAT_DIMENSION_TYPES = [
  'network_effects',
  'switching_costs',
  'intangibles_ip',
  'cost_advantage',
  'data',
  'brand',
  'economies_of_scale',
] as const;
export type MoatDimensionType = (typeof MOAT_DIMENSION_TYPES)[number];

export const MoatDimensionSchema = z.object({
  type: z.enum(MOAT_DIMENSION_TYPES),
  present: z.boolean(),
  strength: z.number().int().min(0).max(100),
  rationale: z.string().min(1),
});

/** Defensible-moat analysis for an idea. */
export const MoatSchema = z.object({
  summary: z.string().min(1),
  defensibilityScore: z.number().int().min(0).max(100),
  dimensions: z.array(MoatDimensionSchema),
  risks: z.array(z.string()),
  citations: z.array(CitationSchema),
});

export type MoatDimension = z.infer<typeof MoatDimensionSchema>;
export type MoatResult = z.infer<typeof MoatSchema>;
