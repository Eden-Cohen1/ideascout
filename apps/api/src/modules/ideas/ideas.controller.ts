import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  type CreateIdeaRequest,
  CreateIdeaRequestSchema,
  type IdeaResponse,
  type IdeaTransitionRequest,
  IdeaTransitionRequestSchema,
  type IdeaVersionResponse,
  type UpdateIdeaRequest,
  UpdateIdeaRequestSchema,
} from '@ideascout/shared';
import type { IdeaVersion } from '@prisma/client';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { ProjectAccessGuard } from '../projects/project-access.guard';
import { IdeasService, type IdeaWithVersion } from './ideas.service';

function toVersionResponse(v: IdeaVersion): IdeaVersionResponse {
  return {
    id: v.id,
    version: v.version,
    problem: v.problem,
    solution: v.solution,
    targetCustomer: v.targetCustomer,
    attributes: (v.attributes ?? {}) as Record<string, unknown>,
    createdAt: v.createdAt.toISOString(),
  };
}

function toIdeaResponse(idea: IdeaWithVersion): IdeaResponse {
  return {
    id: idea.id,
    projectId: idea.projectId,
    title: idea.title,
    state: idea.state,
    currentVersion: idea.currentVersion ? toVersionResponse(idea.currentVersion) : null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
  };
}

// Nested under a project so ProjectAccessGuard enforces ownership for every route.
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateIdeaRequestSchema)) dto: CreateIdeaRequest,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.create(projectId, dto));
  }

  @Get()
  async list(@Param('projectId') projectId: string): Promise<IdeaResponse[]> {
    return (await this.ideas.listForProject(projectId)).map(toIdeaResponse);
  }

  @Get(':ideaId')
  async get(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.getInProject(projectId, ideaId));
  }

  @Patch(':ideaId')
  async update(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(UpdateIdeaRequestSchema)) dto: UpdateIdeaRequest,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.update(projectId, ideaId, dto));
  }

  @Post(':ideaId/transition')
  async transition(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(IdeaTransitionRequestSchema)) dto: IdeaTransitionRequest,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.transition(projectId, ideaId, dto.state));
  }
}
