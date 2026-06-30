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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateProjectRequest,
  CreateProjectRequestSchema,
  type ProjectResponse,
  type UpdateProjectRequest,
  UpdateProjectRequestSchema,
} from '@ideascout/shared';
import type { Project } from '@prisma/client';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger';
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

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiZodBody(CreateProjectRequestSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateProjectRequestSchema)) dto: CreateProjectRequest,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.create(user.id, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the current user's projects" })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ProjectResponse[]> {
    return (await this.projects.listForOwner(user.id)).map(toResponse);
  }

  @UseGuards(ProjectAccessGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a project by id' })
  async get(@Param('id') id: string): Promise<ProjectResponse> {
    return toResponse(await this.projects.getById(id));
  }

  @UseGuards(ProjectAccessGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (incl. AI/research provider selection)' })
  @ApiZodBody(UpdateProjectRequestSchema)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProjectRequestSchema)) dto: UpdateProjectRequest,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.update(id, dto));
  }

  @UseGuards(ProjectAccessGuard)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a project' })
  remove(@Param('id') id: string): Promise<void> {
    return this.projects.remove(id);
  }
}
