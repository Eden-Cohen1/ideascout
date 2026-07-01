import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AppConfigService } from '../../config/config.service';
import type { LlmRegistry } from '../providers/llm/llm.registry';
import { ResearchService } from './research.service';

function deps(overrides: { idea?: unknown; run?: unknown }) {
  const prisma = {
    idea: { findUnique: jest.fn().mockResolvedValue(overrides.idea ?? null) },
    researchRun: {
      create: jest.fn().mockResolvedValue(overrides.run ?? { id: 'r1' }),
      findUnique: jest.fn().mockResolvedValue(overrides.run ?? null),
    },
  } as unknown as PrismaService;
  const config = {
    llm: { defaultProvider: 'openai', defaultModel: undefined },
    research: { defaultProvider: 'tavily' },
  } as unknown as AppConfigService;
  const llm = {
    resolve: jest.fn().mockReturnValue({ defaultModel: 'gpt-4.1-mini' }),
  } as unknown as LlmRegistry;
  const queue = { add: jest.fn().mockResolvedValue({ id: 'r1' }) } as unknown as Queue;
  return { prisma, config, llm, queue, service: new ResearchService(prisma, config, llm, queue) };
}

const ideaInProject = {
  id: 'i1',
  projectId: 'p1',
  currentVersionId: 'v1',
  currentVersion: { id: 'v1' },
  project: { id: 'p1', llmProvider: null, llmModel: null, researchProvider: null },
};

describe('ResearchService.createRun', () => {
  it('creates a QUEUED run with a provider snapshot and enqueues it', async () => {
    const { service, prisma, queue } = deps({ idea: ideaInProject, run: { id: 'r1' } });
    await service.createRun('p1', 'i1');

    expect(prisma.researchRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ideaId: 'i1',
          ideaVersionId: 'v1',
          status: 'QUEUED',
          llmProvider: 'openai',
          llmModel: 'gpt-4.1-mini',
          researchProvider: 'tavily',
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      { runId: 'r1' },
      expect.objectContaining({ jobId: 'r1' }),
    );
  });

  it('honors a per-run provider override', async () => {
    const { service, prisma } = deps({ idea: ideaInProject, run: { id: 'r1' } });
    await service.createRun('p1', 'i1', { llmProvider: 'anthropic', researchProvider: 'mock' });
    expect(prisma.researchRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ llmProvider: 'anthropic', researchProvider: 'mock' }),
      }),
    );
  });

  it('404s when the idea is not in the project', async () => {
    const { service } = deps({ idea: { ...ideaInProject, projectId: 'other' } });
    await expect(service.createRun('p1', 'i1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400s when the idea has no current version', async () => {
    const { service } = deps({
      idea: { ...ideaInProject, currentVersionId: null, currentVersion: null },
    });
    await expect(service.createRun('p1', 'i1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ResearchService.getRun', () => {
  it('returns a run that belongs to the project', async () => {
    const run = { id: 'r1', idea: { projectId: 'p1' }, competitors: [], moat: null };
    const { service } = deps({ run });
    await expect(service.getRun('p1', 'r1')).resolves.toBe(run);
  });

  it('404s when the run belongs to another project', async () => {
    const run = { id: 'r1', idea: { projectId: 'other' }, competitors: [], moat: null };
    const { service } = deps({ run });
    await expect(service.getRun('p1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
