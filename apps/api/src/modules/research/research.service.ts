import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Prisma, type ResearchRun } from '@prisma/client';
import type { StartResearchRequest } from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import { LlmRegistry } from '../providers/llm/llm.registry';
import { RESEARCH_QUEUE, RESEARCH_QUEUE_NAME, type ResearchJobData } from '../jobs/jobs.tokens';

const RUN_INCLUDE = { competitors: true, moat: true, idea: true } as const;
export type ResearchRunDetail = Prisma.ResearchRunGetPayload<{ include: typeof RUN_INCLUDE }>;

@Injectable()
export class ResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly llm: LlmRegistry,
    @Inject(RESEARCH_QUEUE) private readonly queue: Queue<ResearchJobData>,
  ) {}

  /** Create a QUEUED run for the idea's current version and enqueue it. */
  async createRun(
    projectId: string,
    ideaId: string,
    override?: StartResearchRequest,
  ): Promise<ResearchRun> {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: { currentVersion: true, project: true },
    });
    if (!idea || idea.projectId !== projectId) {
      throw new NotFoundException('Idea not found');
    }
    if (!idea.currentVersionId || !idea.currentVersion) {
      throw new BadRequestException('Idea has no current version to research');
    }

    const project = idea.project;
    const llmProvider =
      override?.llmProvider ?? project.llmProvider ?? this.config.llm.defaultProvider;
    const llmModel =
      override?.llmModel ??
      project.llmModel ??
      this.config.llm.defaultModel ??
      this.llm.resolve(llmProvider).defaultModel;
    const researchProvider =
      override?.researchProvider ??
      project.researchProvider ??
      this.config.research.defaultProvider;

    const run = await this.prisma.researchRun.create({
      data: {
        ideaId: idea.id,
        ideaVersionId: idea.currentVersionId,
        status: 'QUEUED',
        progress: 0,
        llmProvider,
        llmModel,
        researchProvider,
      },
    });

    await this.queue.add(
      RESEARCH_QUEUE_NAME,
      { runId: run.id },
      {
        jobId: run.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    return run;
  }

  async getRun(projectId: string, runId: string): Promise<ResearchRunDetail> {
    const run = await this.prisma.researchRun.findUnique({
      where: { id: runId },
      include: RUN_INCLUDE,
    });
    if (!run || run.idea.projectId !== projectId) {
      throw new NotFoundException('Research run not found');
    }
    return run;
  }
}
