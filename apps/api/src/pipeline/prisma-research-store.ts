import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CompetitorMap, MoatResult, ResearchStep, VerdictResult } from '@ideascout/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ResearchStore } from './research-store';
import type { StepArtifact } from './pipeline.types';

/** Cast a JSON-serializable value for Prisma Json columns. */
const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * Prisma-backed ResearchStore — the only place the pipeline touches Postgres. Each
 * structured result is persisted twice: as a typed artifact (exact snapshot for the
 * detail endpoint) and as normalized rows (Competitor / MoatAnalysis) for querying.
 */
@Injectable()
export class PrismaResearchStore implements ResearchStore {
  constructor(private readonly prisma: PrismaService) {}

  async markRunning(runId: string): Promise<void> {
    await this.prisma.researchRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', progress: 0, error: null, startedAt: new Date() },
    });
  }

  async setProgress(runId: string, step: ResearchStep, progress: number): Promise<void> {
    await this.prisma.researchRun.update({
      where: { id: runId },
      data: { currentStep: step, progress },
    });
  }

  async saveArtifact(runId: string, step: ResearchStep, artifact: StepArtifact): Promise<void> {
    await this.prisma.researchArtifact.create({
      data: { runId, step, kind: artifact.kind, payload: json(artifact.payload) },
    });
  }

  async saveCompetitors(runId: string, map: CompetitorMap): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.competitor.deleteMany({ where: { runId } }),
      this.prisma.competitor.createMany({
        data: map.competitors.map((c) => ({
          runId,
          name: c.name,
          url: c.url ?? null,
          product: c.product,
          customer: c.customer,
          positioning: c.positioning ?? null,
          pricingNotes: c.pricingNotes ?? null,
          strengths: json(c.strengths),
          weaknesses: json(c.weaknesses),
          citations: json(c.citations),
        })),
      }),
    ]);
  }

  async saveMoat(runId: string, moat: MoatResult): Promise<void> {
    const data = {
      summary: moat.summary,
      defensibilityScore: moat.defensibilityScore,
      dimensions: json(moat.dimensions),
      risks: json(moat.risks),
      citations: json(moat.citations),
    };
    await this.prisma.moatAnalysis.upsert({
      where: { runId },
      create: { runId, ...data },
      update: data,
    });
  }

  async markSucceeded(runId: string, verdict: VerdictResult): Promise<void> {
    await this.prisma.researchRun.update({
      where: { id: runId },
      data: {
        status: 'SUCCEEDED',
        currentStep: 'VERDICT',
        progress: 100,
        verdict: verdict.verdict,
        verdictScore: verdict.score,
        finishedAt: new Date(),
      },
    });
  }

  async markFailed(runId: string, error: string): Promise<void> {
    await this.prisma.researchRun.update({
      where: { id: runId },
      data: { status: 'FAILED', error, finishedAt: new Date() },
    });
  }
}
