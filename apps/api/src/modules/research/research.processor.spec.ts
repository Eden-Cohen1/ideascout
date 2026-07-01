import type { Job } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ResearchJobData } from '../jobs/jobs.tokens';
import type { AppConfigService } from '../../config/config.service';
import { ResearchProcessor } from './research.processor';

const cfg = { researchStepDelayMs: 0 } as unknown as AppConfigService;

function makeJob(runId = 'r1'): Job<ResearchJobData> & { updateProgress: jest.Mock } {
  return {
    data: { runId },
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<ResearchJobData> & { updateProgress: jest.Mock };
}

describe('ResearchProcessor', () => {
  it('drives the run to SUCCEEDED, advancing progress and emitting events', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      researchRun: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: 'QUEUED' }),
        update,
      },
    } as unknown as PrismaService;
    const job = makeJob('r1');

    await new ResearchProcessor(prisma, cfg).process(job);

    const statuses = update.mock.calls
      .map((c) => (c[0] as { data: { status?: string } }).data.status)
      .filter(Boolean);
    expect(statuses[0]).toBe('RUNNING');
    expect(statuses.at(-1)).toBe('SUCCEEDED');

    const lastEvent = job.updateProgress.mock.calls.at(-1)?.[0];
    expect(lastEvent.status).toBe('SUCCEEDED');
    expect(lastEvent.progress).toBe(100);
    // progress is monotonic non-decreasing across emitted events
    const progresses = job.updateProgress.mock.calls.map((c) => c[0].progress);
    expect(progresses).toEqual([...progresses].sort((a, b) => a - b));
  });

  it('does nothing when the run no longer exists', async () => {
    const update = jest.fn();
    const prisma = {
      researchRun: { findUnique: jest.fn().mockResolvedValue(null), update },
    } as unknown as PrismaService;
    await new ResearchProcessor(prisma, cfg).process(makeJob());
    expect(update).not.toHaveBeenCalled();
  });
});
