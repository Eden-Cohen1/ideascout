import { z } from 'zod';
import {
  CitationSchema,
  CompetitorMapSchema,
  MoatDimensionSchema,
  MoatSchema,
  VerdictSchema,
} from '@ideascout/shared';
import { synthFromSchema } from './synth-from-schema';

describe('synthFromSchema', () => {
  const domainSchemas: Record<string, z.ZodTypeAny> = {
    CitationSchema,
    VerdictSchema,
    CompetitorMapSchema,
    MoatSchema,
    MoatDimensionSchema,
  };

  for (const [name, schema] of Object.entries(domainSchemas)) {
    it(`produces a value that satisfies ${name}`, () => {
      expect(() => schema.parse(synthFromSchema(schema))).not.toThrow();
    });
  }

  it('respects primitive constraints (url, int range, array min, enum)', () => {
    const schema = z.object({
      url: z.string().url(),
      n: z.number().int().min(5).max(10),
      flag: z.boolean(),
      choice: z.enum(['x', 'y']),
      tags: z.array(z.string()).min(2),
      maybe: z.string().optional(),
      withDefault: z.array(z.string()).default([]),
      bag: z.record(z.unknown()),
    });
    const parsed = schema.parse(synthFromSchema(schema));
    expect(parsed.n).toBeGreaterThanOrEqual(5);
    expect(parsed.n).toBeLessThanOrEqual(10);
    expect(parsed.tags.length).toBeGreaterThanOrEqual(2);
    expect(['x', 'y']).toContain(parsed.choice);
  });

  it('is deterministic for the same schema', () => {
    expect(synthFromSchema(VerdictSchema)).toEqual(synthFromSchema(VerdictSchema));
  });
});
