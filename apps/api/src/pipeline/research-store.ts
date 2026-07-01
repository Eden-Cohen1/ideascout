import type { CompetitorMap, MoatResult, ResearchStep, VerdictResult } from '@ideascout/shared';
import type { StepArtifact } from './pipeline.types';

/** DI token for the active ResearchStore implementation. */
export const RESEARCH_STORE = Symbol('RESEARCH_STORE');

/**
 * The persistence seam for the pipeline. The orchestrator and steps depend ONLY on
 * this interface — never on Prisma — so swapping the database (or persisting to a
 * different store entirely) is a single new implementation, no pipeline changes.
 */
export interface ResearchStore {
  /** Mark a run RUNNING and stamp its start. */
  markRunning(runId: string): Promise<void>;

  /** Persist progress + the step just reached (drives the SSE/status view). */
  setProgress(runId: string, step: ResearchStep, progress: number): Promise<void>;

  /** Append a step artifact (audit trail + source for the detail endpoint). */
  saveArtifact(runId: string, step: ResearchStep, artifact: StepArtifact): Promise<void>;

  /** Persist the normalized competitor rows for a run (replaces any prior rows). */
  saveCompetitors(runId: string, map: CompetitorMap): Promise<void>;

  /** Persist the normalized moat analysis for a run (upsert). */
  saveMoat(runId: string, moat: MoatResult): Promise<void>;

  /** Mark a run SUCCEEDED with its final verdict + score. */
  markSucceeded(runId: string, verdict: VerdictResult): Promise<void>;

  /** Mark a run FAILED with an error message, preserving progress. */
  markFailed(runId: string, error: string): Promise<void>;
}
