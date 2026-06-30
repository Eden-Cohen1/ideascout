import { describe, expect, it } from 'vitest';
import {
  CreateIdeaRequestSchema,
  IdeaTransitionRequestSchema,
  IdeaResponseSchema,
} from './idea.dto';

describe('CreateIdeaRequestSchema', () => {
  const valid = {
    title: 'Faster onboarding',
    problem: 'Onboarding is slow',
    solution: 'Automate it',
    targetCustomer: 'B2B SaaS',
  };

  it('parses a valid idea and defaults attributes to {}', () => {
    expect(CreateIdeaRequestSchema.parse(valid).attributes).toEqual({});
  });

  it('requires title, problem, and solution', () => {
    expect(() => CreateIdeaRequestSchema.parse({ title: 'x', problem: 'y' })).toThrow();
  });
});

describe('IdeaTransitionRequestSchema', () => {
  it('accepts a valid lifecycle state', () => {
    expect(IdeaTransitionRequestSchema.parse({ state: 'RESEARCH' }).state).toBe('RESEARCH');
  });

  it('rejects an unknown lifecycle state', () => {
    expect(() => IdeaTransitionRequestSchema.parse({ state: 'DONE' })).toThrow();
  });
});

describe('IdeaResponseSchema', () => {
  it('parses an idea response with a current version', () => {
    const parsed = IdeaResponseSchema.parse({
      id: 'i1',
      projectId: 'p1',
      title: 'Faster onboarding',
      state: 'IDEA',
      currentVersion: {
        id: 'v1',
        version: 1,
        problem: 'p',
        solution: 's',
        targetCustomer: null,
        attributes: {},
        createdAt: '2026-06-30T00:00:00.000Z',
      },
      createdAt: '2026-06-30T00:00:00.000Z',
      updatedAt: '2026-06-30T00:00:00.000Z',
    });
    expect(parsed.currentVersion?.version).toBe(1);
  });
});
