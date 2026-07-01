import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { ResearchProgressEvent } from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import { LlmRegistry } from '../providers/llm/llm.registry';
import { ResearchRegistry } from '../providers/research/research.registry';
import { ResearchPipeline } from '../../pipeline/research-pipeline';
import type { IdeaInput, ResearchContext } from '../../pipeline/pipeline.types';
import type { ResearchJobData } from '../jobs/jobs.tokens';

/**
 * BullMQ entry point for a research run. Its only jobs are I/O wiring: load the run +
 * idea snapshot, resolve the providers named on the run (LLM + web research), then hand
 * a ready ResearchContext to the provider-/DB-agnostic ResearchPipeline. All real work
 * — steps, persistence, progress — lives in the pipeline.
 */
@Injectable()
export class ResearchProcessor {
  private readonly logger = new Logger(ResearchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly llm: LlmRegistry,
    private readonly research: ResearchRegistry,
    private readonly pipeline: ResearchPipeline,
  ) {}

  async process(job: Job<ResearchJobData>): Promise<void> {
    const { runId } = job.data;
    const run = await this.prisma.researchRun.findUnique({
      where: { id: runId },
      include: { idea: true, ideaVersion: true },
    });
    if (!run) {
      this.logger.warn(`run ${runId} not found — skipping`);
      return;
    }

    const idea: IdeaInput = {
      title: run.idea.title,
      problem: run.ideaVersion.problem,
      solution: run.ideaVersion.solution,
      targetCustomer: run.ideaVersion.targetCustomer ?? undefined,
    };

    const ctx: ResearchContext = {
      run,
      idea,
      llm: this.llm.resolve(run.llmProvider),
      research: this.research.resolve(run.researchProvider),
      stepDelayMs: this.config.researchStepDelayMs,
      questions: [],
      pages: [],
    };

    const emit = (event: ResearchProgressEvent): Promise<void> =>
      job.updateProgress(event) as Promise<void>;

    await this.pipeline.run(ctx, emit);
  }
}
