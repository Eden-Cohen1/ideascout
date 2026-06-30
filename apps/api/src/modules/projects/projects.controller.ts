import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type CreateProjectRequest,
  CreateProjectRequestSchema,
  type ProjectResponse,
  type UpdateProjectRequest,
  UpdateProjectRequestSchema,
} from '@ideascout/shared';
import type { Project } from '@prisma/client';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/current-user.decorator';
import { ProjectsService } from './projects.service';
import { ProjectAccessGuard } from './project-access.guard';

function toResponse(p: Project): ProjectResponse {
  return {
    id: p.id,
    ownerId: p.ownerId,
    name: p.name,
    description: p.description,
    llmProvider: p.llmProvider,
    llmModel: p.llmModel,
    researchProvider: p.researchProvider,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateProjectRequestSchema)) dto: CreateProjectRequest,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.create(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ProjectResponse[]> {
    return (await this.projects.listForOwner(user.id)).map(toResponse);
  }

  @UseGuards(ProjectAccessGuard)
  @Get(':id')
  async get(@Param('id') id: string): Promise<ProjectResponse> {
    return toResponse(await this.projects.getById(id));
  }

  @UseGuards(ProjectAccessGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectRequestSchema)) dto: UpdateProjectRequest,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.update(id, dto));
  }

  @UseGuards(ProjectAccessGuard)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.projects.remove(id);
  }
}
