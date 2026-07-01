import type { IdeaResponse, IdeaVersionResponse } from '@ideascout/shared';
import type { IdeaVersion } from '@prisma/client';
import type { IdeaWithVersion } from './ideas.service';

/** Prisma idea-version row → API DTO (JSON attributes, ISO timestamp). */
export function toVersionResponse(v: IdeaVersion): IdeaVersionResponse {
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

/** Prisma idea (+ current version) → the shared `IdeaResponse` contract. */
export function toIdeaResponse(idea: IdeaWithVersion): IdeaResponse {
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
