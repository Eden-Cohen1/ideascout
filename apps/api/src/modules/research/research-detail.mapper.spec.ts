import type { ResearchRunDetail as RunWithRelations } from './research.service';
import { toResearchRunDetail } from './research-detail.mapper';

const baseRun = {
  id: 'r1',
  ideaId: 'i1',
  ideaVersionId: 'v1',
  status: 'SUCCEEDED' as const,
  currentStep: 'VERDICT' as const,
  progress: 100,
  verdict: 'GO' as const,
  verdictScore: 80,
  llmProvider: 'mock',
  llmModel: 'mock-1',
  researchProvider: 'mock',
  jobId: null,
  error: null,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  finishedAt: new Date('2026-01-01T00:01:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  idea: {},
  competitors: [],
  moat: null,
};

function artifact(kind: string, payload: unknown) {
  return { id: 'a', runId: 'r1', step: 'VERDICT', kind, payload, createdAt: new Date() };
}

const verdict = {
  verdict: 'GO',
  score: 80,
  summary: 's',
  reasons: [{ claim: 'c', impact: 'positive', weight: 1 }],
  keyRisks: [],
  conditions: [],
  citations: [],
};

describe('toResearchRunDetail', () => {
  it('maps the latest VERDICT/COMPETITOR_MAP/MOAT artifacts into the DTO', () => {
    const run = {
      ...baseRun,
      artifacts: [
        artifact('VERDICT', verdict),
        artifact('COMPETITOR_MAP', { competitors: [], marketSummary: 'm', segments: [] }),
        artifact('MOAT', {
          summary: 'm',
          defensibilityScore: 40,
          dimensions: [],
          risks: [],
          citations: [],
        }),
      ],
    } as unknown as RunWithRelations;

    const dto = toResearchRunDetail(run);
    expect(dto.verdictResult?.verdict).toBe('GO');
    expect(dto.competitorMap?.marketSummary).toBe('m');
    expect(dto.moat?.defensibilityScore).toBe(40);
    expect(dto.status).toBe('SUCCEEDED');
  });

  it('returns null structured fields when artifacts are absent', () => {
    const run = { ...baseRun, artifacts: [] } as unknown as RunWithRelations;
    const dto = toResearchRunDetail(run);
    expect(dto.verdictResult).toBeNull();
    expect(dto.competitorMap).toBeNull();
    expect(dto.moat).toBeNull();
  });

  it('returns null (not a throw) when an artifact payload fails schema validation', () => {
    const run = {
      ...baseRun,
      artifacts: [artifact('VERDICT', { verdict: 'NOPE' })],
    } as unknown as RunWithRelations;
    expect(toResearchRunDetail(run).verdictResult).toBeNull();
  });
});
