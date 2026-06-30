import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  canTransition,
  type CreateIdeaRequest,
  type IdeaLifecycleState,
  type UpdateIdeaRequest,
} from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';

export type IdeaWithVersion = Prisma.IdeaGetPayload<{ include: { currentVersion: true } }>;

const INCLUDE_CURRENT = { currentVersion: true } as const;

@Injectable()
export class IdeasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create an idea with its immutable version 1, set as the current version. */
  create(projectId: string, dto: CreateIdeaRequest): Promise<IdeaWithVersion> {
    return this.prisma.$transaction(async (tx) => {
      const idea = await tx.idea.create({ data: { projectId, title: dto.title } });
      const version = await tx.ideaVersion.create({
        data: {
          ideaId: idea.id,
          version: 1,
          problem: dto.problem,
          solution: dto.solution,
          targetCustomer: dto.targetCustomer ?? null,
          attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        },
      });
      return tx.idea.update({
        where: { id: idea.id },
        data: { currentVersionId: version.id },
        include: INCLUDE_CURRENT,
      });
    });
  }

  listForProject(projectId: string): Promise<IdeaWithVersion[]> {
    return this.prisma.idea.findMany({
      where: { projectId },
      include: INCLUDE_CURRENT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Fetch an idea, asserting it belongs to the given (already-authorized) project. */
  async getInProject(projectId: string, ideaId: string): Promise<IdeaWithVersion> {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: INCLUDE_CURRENT,
    });
    if (!idea || idea.projectId !== projectId) {
      throw new NotFoundException('Idea not found');
    }
    return idea;
  }

  /** Refining an idea creates a NEW version (immutable history) and repoints current. */
  async update(
    projectId: string,
    ideaId: string,
    dto: UpdateIdeaRequest,
  ): Promise<IdeaWithVersion> {
    const idea = await this.getInProject(projectId, ideaId);
    const current = idea.currentVersion;
    const nextVersion = (current?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.ideaVersion.create({
        data: {
          ideaId: idea.id,
          version: nextVersion,
          problem: dto.problem ?? current?.problem ?? '',
          solution: dto.solution ?? current?.solution ?? '',
          targetCustomer: dto.targetCustomer ?? current?.targetCustomer ?? null,
          attributes: (dto.attributes ?? current?.attributes ?? {}) as Prisma.InputJsonValue,
        },
      });
      return tx.idea.update({
        where: { id: idea.id },
        data: { title: dto.title ?? undefined, currentVersionId: version.id },
        include: INCLUDE_CURRENT,
      });
    });
  }

  async transition(
    projectId: string,
    ideaId: string,
    toState: IdeaLifecycleState,
  ): Promise<IdeaWithVersion> {
    const idea = await this.getInProject(projectId, ideaId);
    if (!canTransition(idea.state, toState)) {
      throw new BadRequestException(`Cannot transition from ${idea.state} to ${toState}`);
    }
    return this.prisma.idea.update({
      where: { id: ideaId },
      data: { state: toState },
      include: INCLUDE_CURRENT,
    });
  }
}
