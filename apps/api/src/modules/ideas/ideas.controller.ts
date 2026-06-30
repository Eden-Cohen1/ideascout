import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { ApiZodBody } from '../../common/swagger';
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
@ApiTags('ideas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Post()
  @ApiOperation({ summary: 'Create an idea (with version 1)' })
  @ApiZodBody(CreateIdeaRequestSchema)
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(CreateIdeaRequestSchema)) dto: CreateIdeaRequest,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.create(projectId, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List ideas in a project' })
  async list(@Param('projectId') projectId: string): Promise<IdeaResponse[]> {
    return (await this.ideas.listForProject(projectId)).map(toIdeaResponse);
  }

  @Get(':ideaId')
  @ApiOperation({ summary: 'Get an idea by id' })
  async get(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.getInProject(projectId, ideaId));
  }

  @Patch(':ideaId')
  @ApiOperation({ summary: 'Refine an idea (creates a new immutable version)' })
  @ApiZodBody(UpdateIdeaRequestSchema)
  async update(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(UpdateIdeaRequestSchema)) dto: UpdateIdeaRequest,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.update(projectId, ideaId, dto));
  }

  @Post(':ideaId/transition')
  @ApiOperation({ summary: 'Transition an idea to a new lifecycle state' })
  @ApiZodBody(IdeaTransitionRequestSchema)
  async transition(
    @Param('projectId') projectId: string,
    @Param('ideaId') ideaId: string,
    @Body(new ZodValidationPipe(IdeaTransitionRequestSchema)) dto: IdeaTransitionRequest,
  ): Promise<IdeaResponse> {
    return toIdeaResponse(await this.ideas.transition(projectId, ideaId, dto.state));
  }
}
