import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  type PostRefinementMessageRequest,
  PostRefinementMessageRequestSchema,
  type RefinementMessageResponse,
} from '@ideascout/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ProjectAccessGuard } from '../projects/project-access.guard';
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
    @Body(new ZodValidationPipe(PostRefinementMessageRequestSchema)) dto: PostRefinementMessageRequest,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const event of this.refinement.generate(projectId, ideaId, dto.content)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    }
    res.end();
  }

  @Post(':messageId/apply')
  @ApiOperation({ summary: 'Apply a proposed patch, creating a new idea version' })
  apply(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.refinement.applyPatch(projectId, ideaId, messageId);
  }
}
