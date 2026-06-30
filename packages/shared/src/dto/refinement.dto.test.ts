import { describe, expect, it } from 'vitest';
import {
  PostRefinementMessageRequestSchema,
  ApplyRefinementRequestSchema,
  RefinementMessageResponseSchema,
} from './refinement.dto';

describe('PostRefinementMessageRequestSchema', () => {
  it('requires non-empty content', () => {
    expect(() => PostRefinementMessageRequestSchema.parse({ content: '' })).toThrow();
    expect(PostRefinementMessageRequestSchema.parse({ content: 'tighten the ICP' }).content).toBe(
      'tighten the ICP',
    );
  });
});

describe('ApplyRefinementRequestSchema', () => {
  it('requires a messageId', () => {
    expect(() => ApplyRefinementRequestSchema.parse({})).toThrow();
  });
});

describe('RefinementMessageResponseSchema', () => {
  it('parses an assistant message with a proposed patch', () => {
    const parsed = RefinementMessageResponseSchema.parse({
      id: 'm1',
      role: 'ASSISTANT',
      content: 'Consider narrowing to fintech.',
      proposedPatch: { targetCustomer: 'Fintech ops teams' },
      appliedVersionId: null,
      createdAt: '2026-06-30T00:00:00.000Z',
    });
    expect(parsed.role).toBe('ASSISTANT');
  });

  it('rejects an invalid role', () => {
    expect(() =>
      RefinementMessageResponseSchema.parse({
        id: 'm1',
        role: 'ROBOT',
        content: 'x',
        createdAt: '2026-06-30T00:00:00.000Z',
      }),
    ).toThrow();
  });
});
