import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ResearchProgressEvent, ResearchStep } from '@ideascout/shared';
import type { PipelineStep, ResearchContext } from './pipeline.types';
import { PIPELINE_STEPS } from './steps';
import { RESEARCH_STORE, type ResearchStore } from './research-store';

/** Sink for live progress events (the processor wires this to `job.updateProgress`). */
export type ProgressEmitter = (event: ResearchProgressEvent) => Promise<void>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives a research run through the ordered steps, persisting via the ResearchStore
 * seam and emitting progress as it goes. It knows NOTHING about BullMQ, Prisma, or any
 * vendor SDK — only the `PipelineStep[]`, the `ResearchStore` interface, and the
 * already-resolved providers carried on the context. Swap any of those without
 * touching this orchestrator.
 */
@Injectable()
export class ResearchPipeline {
  private readonly logger = new Logger(ResearchPipeline.name);

  constructor(
    @Inject(PIPELINE_STEPS) private readonly steps: PipelineStep[],
    @Inject(RESEARCH_STORE) private readonly store: ResearchStore,
  ) {}

  async run(ctx: ResearchContext, emit: ProgressEmitter): Promise<void> {
    const runId = ctx.run.id;
    const total = this.steps.length;

    try {
      await this.store.markRunning(runId);
      await emit(this.event(runId, 'RUNNING', null, 0, 'Starting research'));

      for (let i = 0; i < total; i += 1) {
        const step = this.steps[i];
        this.assertNotAborted(ctx);

        const { artifacts } = await step.execute(ctx);
        for (const artifact of artifacts) {
          await this.store.saveArtifact(runId, step.step, artifact);
        }
        await this.persistStructured(runId, step.step, ctx);

        const progress = Math.round(((i + 1) / total) * 100);
        await this.store.setProgress(runId, step.step, progress);
        await emit(this.event(runId, 'RUNNING', step.step, progress, `Completed ${step.step}`));

        if (ctx.stepDelayMs && i < total - 1) {
          await sleep(ctx.stepDelayMs);
        }
      }

      if (!ctx.verdict) {
        throw new Error('pipeline finished without a verdict');
      }
      await this.store.markSucceeded(runId, ctx.verdict);
      await emit(this.event(runId, 'SUCCEEDED', 'VERDICT', 100, 'Research complete'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`run ${runId} failed: ${message}`);
      await this.store.markFailed(runId, message);
      await emit(
        this.event(runId, 'FAILED', ctx.run.currentStep ?? null, ctx.run.progress, message),
      );
      throw error;
    }
  }

  /** Persist the normalized rows a step may have produced (idempotent per kind). */
  private async persistStructured(
    runId: string,
    step: ResearchStep,
    ctx: ResearchContext,
  ): Promise<void> {
    if (step === 'COMPETITOR_DISCOVERY' && ctx.competitorMap) {
      await this.store.saveCompetitors(runId, ctx.competitorMap);
    } else if (step === 'MOAT_ANALYSIS' && ctx.moat) {
      await this.store.saveMoat(runId, ctx.moat);
    }
  }

  private assertNotAborted(ctx: ResearchContext): void {
    if (ctx.signal?.aborted) {
      throw new Error('research run cancelled');
    }
  }

  private event(
    runId: string,
    status: ResearchProgressEvent['status'],
    step: ResearchStep | null,
    progress: number,
    message: string,
  ): ResearchProgressEvent {
    return { runId, status, step, progress, message, at: new Date().toISOString() };
  }
}
