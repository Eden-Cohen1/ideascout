import { describe, it, expect } from 'vitest';
import { RefinementStreamEventSchema } from './refinement-stream.event';

describe('RefinementStreamEventSchema', () => {
  it('accepts a token event', () => {
    const e = { type: 'token', delta: 'Hel' };
    expect(RefinementStreamEventSchema.parse(e)).toEqual(e);
  });

  it('accepts a terminal message event', () => {
    const e = {
      type: 'message',
      message: {
        id: 'm1',
        role: 'ASSISTANT',
        content: 'hi',
        proposedPatch: null,
        appliedVersionId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    };
    expect(RefinementStreamEventSchema.parse(e)).toMatchObject({ type: 'message' });
  });

  it('accepts an error event', () => {
    expect(RefinementStreamEventSchema.parse({ type: 'error', message: 'boom' }).type).toBe('error');
  });

  it('rejects an unknown type', () => {
    expect(() => RefinementStreamEventSchema.parse({ type: 'nope' })).toThrow();
  });
});
