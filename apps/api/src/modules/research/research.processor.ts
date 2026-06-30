import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { RESEARCH_STEPS, type ResearchProgressEvent, type ResearchStep } from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import type { ResearchJobData } from '../jobs/jobs.tokens';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives a research run through the lifecycle, persisting progress and emitting
 * SSE events via `job.updateProgress`. M7 advances the step state machine with
 * placeholder output; M8 replaces the per-step body with the real pipeline
 * (web research + LLM extraction + citation grounding).
 */
@Injectable()
export class ResearchProcessor {
  private readonly logger = new Logger(ResearchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async process(job: Job<ResearchJobData>): Promise<void> {
    const { runId } = job.data;
    const run = await this.prisma.researchRun.findUnique({ where: { id: runId } });
    if (!run) {
      this.logger.warn(`run ${runId} not found — skipping`);
      return;
    }

    try {
      await this.prisma.researchRun.update({
        where: { id: runId },
        data: { status: 'RUNNING', progress: 0, startedAt: new Date() },
      });
      await this.emit(job, runId, 'RUNNING', null, 0, 'Starting research');

      for (let i = 0; i < RESEARCH_STEPS.length; i += 1) {
        const step: ResearchStep = RESEARCH_STEPS[i];
        const progress = Math.round(((i + 1) / RESEARCH_STEPS.length) * 100);
        // M8: real per-step work (search / fetch / LLM extract) goes here.
        if (this.config.researchStepDelayMs > 0) {
          await sleep(this.config.researchStepDelayMs);
        }
        await this.prisma.researchRun.update({
          where: { id: runId },
          data: { currentStep: step, progress },
        });
        await this.emit(job, runId, 'RUNNING', step, progress, `Completed ${step}`);
      }

      await this.prisma.researchRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCEEDED',
          currentStep: 'VERDICT',
          progress: 100,
          verdict: 'CONDITIONAL_GO',
          verdictScore: 50,
          finishedAt: new Date(),
        },
      });
      await this.emit(job, runId, 'SUCCEEDED', 'VERDICT', 100, 'Research complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.researchRun.update({
        where: { id: runId },
        data: { status: 'FAILED', error: message, finishedAt: new Date() },
      });
      await this.emit(job, runId, 'FAILED', null, run.progress, message);
      throw error;
    }
  }

  private async emit(
    job: Job<ResearchJobData>,
    runId: string,
    status: ResearchProgressEvent['status'],
    step: ResearchStep | null,
    progress: number,
    message: string,
  ): Promise<void> {
    const event: ResearchProgressEvent = {
      runId,
      status,
      step,
      progress,
      message,
      at: new Date().toISOString(),
    };
    await job.updateProgress(event);
  }
}
