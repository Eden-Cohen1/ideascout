import {
  CompetitorMapSchema,
  MoatSchema,
  type ResearchRunDetail,
  type ResearchRunSummary,
  VerdictSchema,
} from '@ideascout/shared';
import type { ZodType, ZodTypeDef } from 'zod';
import type { ResearchRun } from '@prisma/client';
import type { ResearchRunDetail as RunWithRelations } from './research.service';

/** Flat run row → summary DTO (ISO timestamps, nullable fields normalized). */
export function toResearchRunSummary(run: ResearchRun): ResearchRunSummary {
  return {
    id: run.id,
    ideaId: run.ideaId,
    ideaVersionId: run.ideaVersionId,
    status: run.status,
    currentStep: run.currentStep ?? null,
    progress: run.progress,
    verdict: run.verdict ?? null,
    verdictScore: run.verdictScore ?? null,
    llmProvider: run.llmProvider,
    llmModel: run.llmModel,
    researchProvider: run.researchProvider,
    error: run.error ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}

type ArtifactRow = RunWithRelations['artifacts'][number];

/** Latest artifact payload of a kind, validated through its shared schema (null if absent/invalid). */
function structuredArtifact<T>(
  artifacts: ArtifactRow[],
  kind: ArtifactRow['kind'],
  schema: ZodType<T, ZodTypeDef, unknown>,
): T | null {
  const payload = artifacts.find((a) => a.kind === kind)?.payload;
  if (payload === undefined || payload === null) {
    return null;
  }
  const parsed = schema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Run + relations → detail DTO. The structured results come from the latest typed
 * artifacts (the exact pipeline output), re-validated against the SAME shared schemas
 * the pipeline produced them with — so the API can never emit a drifted shape.
 */
export function toResearchRunDetail(run: RunWithRelations): ResearchRunDetail {
  return {
    ...toResearchRunSummary(run),
    verdictResult: structuredArtifact(run.artifacts, 'VERDICT', VerdictSchema),
    competitorMap: structuredArtifact(run.artifacts, 'COMPETITOR_MAP', CompetitorMapSchema),
    moat: structuredArtifact(run.artifacts, 'MOAT', MoatSchema),
  };
}
