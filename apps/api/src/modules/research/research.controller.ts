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
import { Throttle } from '@nestjs/throttler';
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
import { ResearchService } from './research.service';
import { toResearchRunDetail, toResearchRunSummary } from './research-detail.mapper';

const TERMINAL = new Set<ResearchRun['status']>(['SUCCEEDED', 'FAILED', 'CANCELLED']);

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

// A research run enqueues the full pipeline (many LLM + web calls) — the most
// expensive operation in the app. Rate-limit far tighter than the global 100/min.
const RESEARCH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

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
  @Throttle(RESEARCH_THROTTLE)
  @ApiOperation({ summary: 'Start a research run for an idea (enqueues the pipeline)' })
  @ApiZodBody(StartResearchRequestSchema)
  async start(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(StartResearchRequestSchema)) dto: StartResearchRequest,
  ): Promise<ResearchRunSummary> {
    return toResearchRunSummary(await this.research.createRun(projectId, ideaId, dto));
  }

  @Get('research/:runId')
  @ApiOperation({ summary: 'Get a research run (status + results)' })
  async get(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ): Promise<ResearchRunDetail> {
    return toResearchRunDetail(await this.research.getRun(projectId, runId));
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
