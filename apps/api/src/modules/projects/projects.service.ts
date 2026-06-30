import { Injectable, NotFoundException } from '@nestjs/common';
import type { Project } from '@prisma/client';
import type { CreateProjectRequest, UpdateProjectRequest } from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateProjectRequest): Promise<Project> {
    return this.prisma.project.create({
      data: { ownerId, name: dto.name, description: dto.description ?? null },
    });
  }

  listForOwner(ownerId: string): Promise<Project[]> {
    return this.prisma.project.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
  }

  async getById(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  update(id: string, dto: UpdateProjectRequest): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        llmProvider: dto.llmProvider,
        llmModel: dto.llmModel,
        researchProvider: dto.researchProvider,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
