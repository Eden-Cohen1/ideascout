import type { ArtifactKind, ResearchRun } from '@prisma/client';
import type { CompetitorMap, MoatResult, ResearchStep, VerdictResult } from '@ideascout/shared';
import type { LlmProvider } from '../modules/providers/llm/llm-provider.interface';
import type {
  FetchedPage,
  ResearchProvider,
} from '../modules/providers/research/research-provider.interface';

/**
 * The idea snapshot a run reasons about. Flattened from the idea's current version
 * so steps never reach back into Prisma — they depend only on this plain object.
 */
export interface IdeaInput {
  title: string;
  problem: string;
  solution: string;
  targetCustomer?: string;
}

/**
 * Mutable state threaded through the pipeline. Each step reads what earlier steps
 * produced and appends its own output. Providers arrive already resolved (via the
 * registries) so steps depend ONLY on the provider interfaces, never on a vendor SDK
 * or on how the provider was chosen.
 */
export interface ResearchContext {
  readonly run: ResearchRun;
  readonly idea: IdeaInput;
  readonly llm: LlmProvider;
  readonly research: ResearchProvider;
  readonly signal?: AbortSignal;
  /** Optional artificial pause between steps (dev/demo, to watch SSE progress tick). */
  readonly stepDelayMs?: number;

  /** Sub-questions produced by DECOMPOSE; drive the search step. */
  questions: string[];
  /** Fetched page corpus — the ONLY valid grounding source for citations. */
  pages: FetchedPage[];

  competitorMap?: CompetitorMap;
  moat?: MoatResult;
  verdict?: VerdictResult;
}

/** A persisted side-effect of a step (audit trail + source for the detail endpoint). */
export interface StepArtifact {
  kind: ArtifactKind;
  payload: unknown;
}

/** What a step hands back: artifacts to persist. Context is mutated in place. */
export interface StepResult {
  artifacts: StepArtifact[];
}

/**
 * The plug-in unit of the pipeline. The orchestrator runs an ORDERED array of these;
 * adding, removing, or reordering a stage is a one-line change to that array. A step
 * depends only on `ResearchContext` — provider-agnostic and DB-agnostic by construction.
 */
export interface PipelineStep {
  readonly step: ResearchStep;
  execute(ctx: ResearchContext): Promise<StepResult>;
}
