import { describe, expect, it } from 'vitest';
import {
  StartResearchRequestSchema,
  ResearchRunSummarySchema,
  ResearchRunDetailSchema,
} from './research.dto';

describe('StartResearchRequestSchema', () => {
  it('accepts an empty body (use project/global defaults)', () => {
    expect(() => StartResearchRequestSchema.parse({})).not.toThrow();
  });

  it('accepts a provider override', () => {
    const parsed = StartResearchRequestSchema.parse({ llmProvider: 'gemini' });
    expect(parsed.llmProvider).toBe('gemini');
  });

  it('rejects an unknown provider id', () => {
    expect(() => StartResearchRequestSchema.parse({ researchProvider: 'duckduckgo' })).toThrow();
  });
});

describe('ResearchRunSummarySchema', () => {
  const base = {
    id: 'r1',
    ideaId: 'i1',
    ideaVersionId: 'v1',
    status: 'RUNNING',
    currentStep: 'COMPETITOR_DISCOVERY',
    progress: 40,
    llmProvider: 'openai',
    llmModel: 'mock',
    researchProvider: 'mock',
    createdAt: '2026-06-30T00:00:00.000Z',
  };

  it('parses a run summary', () => {
    expect(ResearchRunSummarySchema.parse(base)).toMatchObject({ status: 'RUNNING', progress: 40 });
  });

  it('rejects an invalid status', () => {
    expect(() => ResearchRunSummarySchema.parse({ ...base, status: 'PAUSED' })).toThrow();
  });

  it('rejects progress above 100', () => {
    expect(() => ResearchRunSummarySchema.parse({ ...base, progress: 140 })).toThrow();
  });
});

describe('ResearchRunDetailSchema', () => {
  it('parses a detailed run with verdict, competitors, and moat as nullable', () => {
    const parsed = ResearchRunDetailSchema.parse({
      id: 'r1',
      ideaId: 'i1',
      ideaVersionId: 'v1',
      status: 'SUCCEEDED',
      progress: 100,
      llmProvider: 'openai',
      llmModel: 'mock',
      researchProvider: 'mock',
      createdAt: '2026-06-30T00:00:00.000Z',
      verdictResult: null,
      competitorMap: null,
      moat: null,
    });
    expect(parsed.status).toBe('SUCCEEDED');
  });
});
