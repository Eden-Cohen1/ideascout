import { describe, expect, it } from 'vitest';
import { VerdictSchema } from './verdict.schema';

describe('VerdictSchema', () => {
  const valid = {
    verdict: 'CONDITIONAL_GO',
    score: 72,
    summary: 'Promising but crowded.',
    reasons: [{ claim: 'Large TAM', impact: 'positive', weight: 0.8 }],
    keyRisks: ['Incumbent retaliation'],
    conditions: ['Find a wedge segment'],
    citations: [{ url: 'https://example.com', title: 'Market report' }],
  };

  it('parses a valid verdict', () => {
    expect(VerdictSchema.parse(valid)).toMatchObject({ verdict: 'CONDITIONAL_GO', score: 72 });
  });

  it('defaults conditions to an empty array', () => {
    const { conditions: _c, ...withoutConditions } = valid;
    expect(VerdictSchema.parse(withoutConditions).conditions).toEqual([]);
  });

  it('rejects an unknown verdict value', () => {
    expect(() => VerdictSchema.parse({ ...valid, verdict: 'MAYBE' })).toThrow();
  });

  it('rejects a score above 100', () => {
    expect(() => VerdictSchema.parse({ ...valid, score: 101 })).toThrow();
  });

  it('rejects a non-integer score', () => {
    expect(() => VerdictSchema.parse({ ...valid, score: 72.5 })).toThrow();
  });

  it('requires at least one reason', () => {
    expect(() => VerdictSchema.parse({ ...valid, reasons: [] })).toThrow();
  });

  it('rejects a reason weight above 1', () => {
    expect(() =>
      VerdictSchema.parse({ ...valid, reasons: [{ claim: 'x', impact: 'positive', weight: 1.5 }] }),
    ).toThrow();
  });

  it('rejects a citation with a non-URL', () => {
    expect(() =>
      VerdictSchema.parse({ ...valid, citations: [{ url: 'nope', title: 't' }] }),
    ).toThrow();
  });
});
