import { Injectable, NotFoundException } from '@nestjs/common';
import type { RefinementMessage } from '@prisma/client';
import {
  type ProposedPatch,
  type RefinementMessageResponse,
} from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import { LlmRegistry } from '../providers/llm/llm.registry';
import { IdeasService } from '../ideas/ideas.service';

type IdeaWithVersion = {
  id: string;
  projectId: string;
  currentVersion: { problem: string; solution: string; targetCustomer: string | null } | null;
};

@Injectable()
export class RefinementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService, // Used in future tasks
    private readonly llm: LlmRegistry, // Used in future tasks
    private readonly ideas: IdeasService, // Used in future tasks
  ) {
    // Preserve dependency declarations for future use
    void this.config;
    void this.llm;
    void this.ideas;
  }

  /** Prisma row → API DTO (ISO timestamp, patch coerced to the shared shape or null). */
  toMessageResponse(msg: RefinementMessage): RefinementMessageResponse {
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      proposedPatch: (msg.proposedPatch as ProposedPatch | null) ?? null,
      appliedVersionId: msg.appliedVersionId ?? null,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  async listThread(projectId: string, ideaId: string): Promise<RefinementMessageResponse[]> {
    await this.loadIdeaOrThrow(projectId, ideaId);
    const rows = await this.prisma.refinementMessage.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toMessageResponse(r));
  }

  /** Load the idea + current version, asserting it belongs to the (authorized) project. */
  private async loadIdeaOrThrow(projectId: string, ideaId: string): Promise<IdeaWithVersion> {
    const idea = (await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: { currentVersion: true },
    })) as IdeaWithVersion | null;
    if (!idea || idea.projectId !== projectId) {
      throw new NotFoundException('Idea not found');
    }
    return idea;
  }
}
