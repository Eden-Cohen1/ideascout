import { describe, expect, it } from 'vitest';
import { MoatSchema, MoatDimensionSchema } from './moat.schema';

describe('MoatDimensionSchema', () => {
  const valid = {
    type: 'network_effects',
    present: true,
    strength: 60,
    rationale: 'Two-sided marketplace dynamics.',
  };

  it('parses a valid dimension', () => {
    expect(MoatDimensionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an unknown dimension type', () => {
    expect(() => MoatDimensionSchema.parse({ ...valid, type: 'magic' })).toThrow();
  });

  it('rejects a strength outside 0..100', () => {
    expect(() => MoatDimensionSchema.parse({ ...valid, strength: 120 })).toThrow();
  });
});

describe('MoatSchema', () => {
  const valid = {
    summary: 'Moderate defensibility via data.',
    defensibilityScore: 55,
    dimensions: [{ type: 'data', present: true, strength: 70, rationale: 'Proprietary dataset.' }],
    risks: ['Data can be replicated'],
    citations: [{ url: 'https://example.com', title: 'Analysis' }],
  };

  it('parses a valid moat analysis', () => {
    expect(MoatSchema.parse(valid)).toMatchObject({ defensibilityScore: 55 });
  });

  it('rejects a defensibilityScore above 100', () => {
    expect(() => MoatSchema.parse({ ...valid, defensibilityScore: 101 })).toThrow();
  });
});
