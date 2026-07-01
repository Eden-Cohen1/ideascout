import type { Job } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ResearchJobData } from '../jobs/jobs.tokens';
import type { AppConfigService } from '../../config/config.service';
import type { LlmRegistry } from '../providers/llm/llm.registry';
import type { ResearchRegistry } from '../providers/research/research.registry';
import type { ResearchPipeline } from '../../pipeline/research-pipeline';
import type { ResearchContext } from '../../pipeline/pipeline.types';
import { ResearchProcessor } from './research.processor';

function makeJob(runId = 'r1'): Job<ResearchJobData> & { updateProgress: jest.Mock } {
  return {
    data: { runId },
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<ResearchJobData> & { updateProgress: jest.Mock };
}

const run = {
  id: 'r1',
  llmProvider: 'mock',
  researchProvider: 'mock',
  llmModel: 'mock-1',
  idea: { title: 'Acme' },
  ideaVersion: { problem: 'p', solution: 's', targetCustomer: null },
};

function makeDeps(found: unknown = run) {
  const prisma = {
    researchRun: { findUnique: jest.fn().mockResolvedValue(found) },
  } as unknown as PrismaService;
  const config = { researchStepDelayMs: 0 } as unknown as AppConfigService;
  const llm = { resolve: jest.fn().mockReturnValue({ id: 'mock' }) } as unknown as LlmRegistry;
  const research = {
    resolve: jest.fn().mockReturnValue({ id: 'mock' }),
  } as unknown as ResearchRegistry;
  const pipeline = { run: jest.fn().mockResolvedValue(undefined) } as unknown as ResearchPipeline;
  return { prisma, config, llm, research, pipeline };
}

describe('ResearchProcessor', () => {
  it('builds a context from the run snapshot and delegates to the pipeline', async () => {
    const deps = makeDeps();
    const job = makeJob('r1');

    await new ResearchProcessor(
      deps.prisma,
      deps.config,
      deps.llm,
      deps.research,
      deps.pipeline,
    ).process(job);

    expect(deps.llm.resolve).toHaveBeenCalledWith('mock');
    expect(deps.research.resolve).toHaveBeenCalledWith('mock');
    const [ctx, emit] = (deps.pipeline.run as jest.Mock).mock.calls[0] as [
      ResearchContext,
      (e: unknown) => Promise<void>,
    ];
    expect(ctx.idea).toEqual({
      title: 'Acme',
      problem: 'p',
      solution: 's',
      targetCustomer: undefined,
    });
    expect(ctx.questions).toEqual([]);

    // the emitter forwards events to the job's progress channel
    await emit({ runId: 'r1', status: 'RUNNING', step: null, progress: 0, at: 'now' });
    expect(job.updateProgress).toHaveBeenCalled();
  });

  it('does nothing when the run no longer exists', async () => {
    const deps = makeDeps(null);
    await new ResearchProcessor(
      deps.prisma,
      deps.config,
      deps.llm,
      deps.research,
      deps.pipeline,
    ).process(makeJob());
    expect(deps.pipeline.run).not.toHaveBeenCalled();
  });
});
