import { describe, expect, it } from 'vitest';
import { ResearchProgressEventSchema } from './research-progress.event';

describe('ResearchProgressEventSchema', () => {
  const valid = {
    runId: 'r1',
    status: 'RUNNING',
    step: 'MARKET_RESEARCH',
    progress: 30,
    message: 'Fetched 8 pages',
    at: '2026-06-30T00:00:00.000Z',
  };

  it('parses a valid progress event', () => {
    expect(ResearchProgressEventSchema.parse(valid)).toMatchObject({ progress: 30 });
  });

  it('allows a null step (e.g. queued/finished)', () => {
    expect(() => ResearchProgressEventSchema.parse({ ...valid, step: null })).not.toThrow();
  });

  it('treats message as optional', () => {
    const { message: _m, ...rest } = valid;
    expect(() => ResearchProgressEventSchema.parse(rest)).not.toThrow();
  });

  it('rejects an invalid status', () => {
    expect(() => ResearchProgressEventSchema.parse({ ...valid, status: 'PAUSED' })).toThrow();
  });

  it('rejects progress above 100', () => {
    expect(() => ResearchProgressEventSchema.parse({ ...valid, progress: 101 })).toThrow();
  });
});
