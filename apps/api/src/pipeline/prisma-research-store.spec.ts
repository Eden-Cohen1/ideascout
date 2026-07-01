import type { CompetitorMap, MoatResult, VerdictResult } from '@ideascout/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { PrismaResearchStore } from './prisma-research-store';

function makePrisma() {
  return {
    researchRun: { update: jest.fn().mockResolvedValue({}) },
    researchArtifact: { create: jest.fn().mockResolvedValue({}) },
    competitor: {
      deleteMany: jest.fn().mockReturnValue('del'),
      createMany: jest.fn().mockReturnValue('create'),
    },
    moatAnalysis: { upsert: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

describe('PrismaResearchStore', () => {
  it('markRunning sets RUNNING and clears prior error', async () => {
    const prisma = makePrisma();
    await new PrismaResearchStore(prisma as unknown as PrismaService).markRunning('r1');
    expect(prisma.researchRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ status: 'RUNNING', error: null }),
      }),
    );
  });

  it('setProgress records currentStep + progress', async () => {
    const prisma = makePrisma();
    await new PrismaResearchStore(prisma as unknown as PrismaService).setProgress(
      'r1',
      'MOAT_ANALYSIS',
      60,
    );
    expect(prisma.researchRun.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { currentStep: 'MOAT_ANALYSIS', progress: 60 },
    });
  });

  it('saveArtifact writes step + kind + payload', async () => {
    const prisma = makePrisma();
    await new PrismaResearchStore(prisma as unknown as PrismaService).saveArtifact(
      'r1',
      'DECOMPOSE',
      {
        kind: 'LLM_RAW',
        payload: { questions: ['q'] },
      },
    );
    expect(prisma.researchArtifact.create).toHaveBeenCalledWith({
      data: { runId: 'r1', step: 'DECOMPOSE', kind: 'LLM_RAW', payload: { questions: ['q'] } },
    });
  });

  it('saveCompetitors replaces rows in a transaction and maps optionals to null', async () => {
    const prisma = makePrisma();
    const map: CompetitorMap = {
      competitors: [
        { name: 'A', product: 'p', customer: 'c', strengths: ['s'], weaknesses: [], citations: [] },
      ],
      marketSummary: 'm',
      segments: [],
    };
    await new PrismaResearchStore(prisma as unknown as PrismaService).saveCompetitors('r1', map);
    expect(prisma.competitor.deleteMany).toHaveBeenCalledWith({ where: { runId: 'r1' } });
    const createArg = prisma.competitor.createMany.mock.calls[0][0];
    expect(createArg.data[0]).toMatchObject({
      runId: 'r1',
      name: 'A',
      url: null,
      positioning: null,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['del', 'create']);
  });

  it('saveMoat upserts by runId', async () => {
    const prisma = makePrisma();
    const moat: MoatResult = {
      summary: 's',
      defensibilityScore: 40,
      dimensions: [],
      risks: [],
      citations: [],
    };
    await new PrismaResearchStore(prisma as unknown as PrismaService).saveMoat('r1', moat);
    expect(prisma.moatAnalysis.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { runId: 'r1' } }),
    );
  });

  it('markSucceeded promotes verdict + score onto the run', async () => {
    const prisma = makePrisma();
    const verdict: VerdictResult = {
      verdict: 'GO',
      score: 80,
      summary: 's',
      reasons: [{ claim: 'c', impact: 'positive', weight: 1 }],
      keyRisks: [],
      conditions: [],
      citations: [],
    };
    await new PrismaResearchStore(prisma as unknown as PrismaService).markSucceeded('r1', verdict);
    expect(prisma.researchRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUCCEEDED',
          verdict: 'GO',
          verdictScore: 80,
          progress: 100,
        }),
      }),
    );
  });

  it('markFailed records the error', async () => {
    const prisma = makePrisma();
    await new PrismaResearchStore(prisma as unknown as PrismaService).markFailed('r1', 'boom');
    expect(prisma.researchRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', error: 'boom' }),
      }),
    );
  });
});
