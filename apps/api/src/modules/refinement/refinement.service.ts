import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { RefinementMessage } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  CompetitorMapSchema,
  type ProposedPatch,
  type RefinementMessageResponse,
  type RefinementStreamEvent,
  VerdictSchema,
} from '@ideascout/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import { LlmRegistry } from '../providers/llm/llm.registry';
import { IdeasService } from '../ideas/ideas.service';
import {
  buildRefinementContext,
  type HistoryTurn,
  type ResearchSummary,
  ideaBrief,
} from './refinement.context';
import { PatchExtractionSchema, patchExtractionMessages } from './refinement.prompt';

type IdeaWithVersion = {
  id: string;
  projectId: string;
  currentVersion: { problem: string; solution: string; targetCustomer: string | null } | null;
};

@Injectable()
export class RefinementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly llm: LlmRegistry,
    private readonly ideas: IdeasService,
  ) {}

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

  /**
   * Generate the advisor's reply for a new user message. Persists the user message, then
   * streams the reply as `token` frames; on completion persists the assistant message,
   * extracts an optional patch, and yields a terminal `message` frame. Any failure yields
   * a single `error` frame (the assistant message is not persisted).
   */
  async *generate(
    projectId: string,
    ideaId: string,
    content: string,
  ): AsyncGenerator<RefinementStreamEvent> {
    const idea = await this.loadIdeaOrThrow(projectId, ideaId);
    if (!idea.currentVersion) {
      throw new NotFoundException('Idea has no current version');
    }

    // Persist the user turn before generating (so the thread records the question).
    const userMsg = await this.prisma.refinementMessage.create({
      data: { ideaId, role: 'USER', content },
    });

    try {
      const [research, history, { provider, model }] = await Promise.all([
        this.loadResearchSummary(ideaId),
        this.loadHistory(ideaId, userMsg.id),
        this.resolveLlm(projectId),
      ]);

      const messages = buildRefinementContext(idea.currentVersion, research, history, content);

      let reply = '';
      for await (const chunk of provider.stream(messages, { model })) {
        if (chunk.delta) {
          reply += chunk.delta;
          yield { type: 'token', delta: chunk.delta };
        }
      }

      const patch = await this.extractPatch(provider, model, idea.currentVersion, reply);
      const saved = await this.prisma.refinementMessage.create({
        data: {
          ideaId,
          role: 'ASSISTANT',
          content: reply,
          proposedPatch: (patch as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });
      yield { type: 'message', message: this.toMessageResponse(saved) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message };
    }
  }

  /** Apply a message's proposed patch → new idea version; link it back to the message. */
  async applyPatch(
    projectId: string,
    ideaId: string,
    messageId: string,
  ): Promise<Awaited<ReturnType<IdeasService['update']>>> {
    await this.loadIdeaOrThrow(projectId, ideaId);
    const message = await this.prisma.refinementMessage.findUnique({ where: { id: messageId } });
    if (!message || message.ideaId !== ideaId) {
      throw new NotFoundException('Refinement message not found');
    }
    const patch = message.proposedPatch as ProposedPatch | null;
    if (!patch || Object.keys(patch).length === 0) {
      throw new BadRequestException('Message has no proposed patch to apply');
    }
    if (message.appliedVersionId) {
      throw new BadRequestException('Patch has already been applied');
    }

    const updated = await this.ideas.update(projectId, ideaId, {
      problem: patch.problem,
      solution: patch.solution,
      targetCustomer: patch.targetCustomer,
      attributes: patch.attributes,
    });
    await this.prisma.refinementMessage.update({
      where: { id: messageId },
      data: { appliedVersionId: updated.currentVersionId },
    });
    return updated;
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

  /** Summarize the most recent SUCCEEDED research run for the idea (null if none). */
  private async loadResearchSummary(ideaId: string): Promise<ResearchSummary | null> {
    const run = await this.prisma.researchRun.findFirst({
      where: { ideaId, status: 'SUCCEEDED' },
      orderBy: { finishedAt: 'desc' },
      include: {
        moat: true,
        artifacts: {
          where: { kind: { in: ['VERDICT', 'COMPETITOR_MAP'] } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!run) return null;

    const verdictPayload = run.artifacts.find((a) => a.kind === 'VERDICT')?.payload;
    const verdict = VerdictSchema.safeParse(verdictPayload);
    const competitorPayload = run.artifacts.find((a) => a.kind === 'COMPETITOR_MAP')?.payload;
    const competitor = CompetitorMapSchema.safeParse(competitorPayload);

    return {
      verdict: run.verdict ?? (verdict.success ? verdict.data.verdict : 'UNKNOWN'),
      score: run.verdictScore ?? null,
      keyRisks: verdict.success ? verdict.data.keyRisks : [],
      marketSummary: competitor.success ? competitor.data.marketSummary : undefined,
      moatSummary: run.moat?.summary ?? undefined,
    };
  }

  /** Prior turns (excluding SYSTEM and the current user message) as history for context builder. */
  private async loadHistory(ideaId: string, excludeId?: string): Promise<HistoryTurn[]> {
    const rows = await this.prisma.refinementMessage.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .filter((r) => r.id !== excludeId && (r.role === 'USER' || r.role === 'ASSISTANT'))
      .map((r) => ({ role: r.role as HistoryTurn['role'], content: r.content }));
  }

  /** Resolve the LLM provider + model for an idea's project (project default → global). */
  private async resolveLlm(
    projectId: string,
  ): Promise<{ provider: ReturnType<LlmRegistry['resolve']>; model: string | undefined }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const provider = this.llm.resolve(project?.llmProvider ?? this.config.llm.defaultProvider);
    const model = project?.llmModel ?? this.config.llm.defaultModel ?? provider.defaultModel;
    return { provider, model };
  }

  /** Second (structured) call: extract an idea patch from the reply; null if empty. */
  private async extractPatch(
    provider: ReturnType<LlmRegistry['resolve']>,
    model: string | undefined,
    version: { problem: string; solution: string; targetCustomer: string | null },
    reply: string,
  ): Promise<ProposedPatch | null> {
    const { value } = await provider.structured(
      patchExtractionMessages(ideaBrief(version), reply),
      PatchExtractionSchema,
      { model, schemaName: 'PatchExtraction' },
    );
    const patch: ProposedPatch = {};
    if (value.problem) patch.problem = value.problem;
    if (value.solution) patch.solution = value.solution;
    if (value.targetCustomer) patch.targetCustomer = value.targetCustomer;
    return Object.keys(patch).length > 0 ? patch : null;
  }
}
