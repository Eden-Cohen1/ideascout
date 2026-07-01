import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  type IdeaResponse,
  type PostRefinementMessageRequest,
  PostRefinementMessageRequestSchema,
  type RefinementMessageResponse,
} from '@ideascout/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ProjectAccessGuard } from '../projects/project-access.guard';
import { streamSse } from '../../common/sse';
import { toIdeaResponse } from '../ideas/ideas.mapper';
import { RefinementService } from './refinement.service';

// Tighter than the global 100/min: each refinement message triggers 2 LLM calls.
const REFINEMENT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('refinement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/ideas/:ideaId/refine')
export class RefinementController {
  constructor(private readonly refinement: RefinementService) {}

  @Get()
  @ApiOperation({ summary: 'List the refinement conversation for an idea' })
  thread(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
  ): Promise<RefinementMessageResponse[]> {
    return this.refinement.listThread(projectId, ideaId);
  }

  @Post()
  @Throttle(REFINEMENT_THROTTLE)
  @ApiOperation({ summary: 'Post a refinement message; streams the advisor reply as SSE' })
  @ApiZodBody(PostRefinementMessageRequestSchema)
  async stream(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(PostRefinementMessageRequestSchema))
    dto: PostRefinementMessageRequest,
    @Res() res: Response,
  ): Promise<void> {
    await streamSse(res, this.refinement.generate(projectId, ideaId, dto.content), (error) => ({
      type: 'error' as const,
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }

  @Post(':messageId/apply')
  @ApiOperation({ summary: 'Apply a proposed patch, creating a new idea version' })
  async apply(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Param('messageId') messageId: string,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.refinement.applyPatch(projectId, ideaId, messageId));
  }
}
