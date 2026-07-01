import {
  Body,
  Controller,
  Get,
  type MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { concat, from, map, type Observable, of, switchMap } from 'rxjs';
import {
  type ResearchProgressEvent,
  type ResearchRunDetail,
  type ResearchRunSummary,
  type StartResearchRequest,
  StartResearchRequestSchema,
} from '@ideascout/shared';
import type { ResearchRun } from '@prisma/client';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ProjectAccessGuard } from '../projects/project-access.guard';
import { ResearchProgressBridge } from '../jobs/research-progress.bridge';
import { ResearchService, type ResearchRunDetail as RunWithRelations } from './research.service';

const TERMINAL = new Set<ResearchRun['status']>(['SUCCEEDED', 'FAILED', 'CANCELLED']);

function toSummary(run: ResearchRun): ResearchRunSummary {
  return {
    id: run.id,
    ideaId: run.ideaId,
    ideaVersionId: run.ideaVersionId,
    status: run.status,
    currentStep: run.currentStep ?? null,
    progress: run.progress,
    verdict: run.verdict ?? null,
    verdictScore: run.verdictScore ?? null,
    llmProvider: run.llmProvider,
    llmModel: run.llmModel,
    researchProvider: run.researchProvider,
    error: run.error ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}

function toDetail(run: RunWithRelations): ResearchRunDetail {
  // Structured artifacts (verdictResult / competitorMap / moat) are produced by the
  // pipeline in M8; null until then.
  return { ...toSummary(run), verdictResult: null, competitorMap: null, moat: null };
}

function currentStateEvent(run: ResearchRun): ResearchProgressEvent {
  return {
    runId: run.id,
    status: run.status,
    step: run.currentStep ?? null,
    progress: run.progress,
    message: 'current state',
    at: new Date().toISOString(),
  };
}

@ApiTags('research')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId')
export class ResearchController {
  constructor(
    private readonly research: ResearchService,
    private readonly bridge: ResearchProgressBridge,
  ) {}

  @Post('ideas/:ideaId/research')
  @ApiOperation({ summary: 'Start a research run for an idea (enqueues the pipeline)' })
  @ApiZodBody(StartResearchRequestSchema)
  async start(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(StartResearchRequestSchema)) dto: StartResearchRequest,
  ): Promise<ResearchRunSummary> {
    return toSummary(await this.research.createRun(projectId, ideaId, dto));
  }

  @Get('research/:runId')
  @ApiOperation({ summary: 'Get a research run (status + results)' })
  async get(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ): Promise<ResearchRunDetail> {
    return toDetail(await this.research.getRun(projectId, runId));
  }

  @Sse('research/:runId/stream')
  @ApiOperation({ summary: 'Stream live research progress (SSE)' })
  stream(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ): Observable<MessageEvent> {
    return from(this.research.getRun(projectId, runId)).pipe(
      switchMap((run) => {
        const current = currentStateEvent(run);
        return TERMINAL.has(run.status)
          ? of(current)
          : concat(of(current), this.bridge.stream(runId));
      }),
      map((event) => ({ data: event }) as MessageEvent),
    );
  }
}
