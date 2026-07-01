import type { Provider, Type } from '@nestjs/common';
import type { PipelineStep } from '../pipeline.types';
import { DecomposeStep } from './decompose.step';
import { MarketResearchStep } from './market-research.step';
import { CompetitorDiscoveryStep } from './competitor-discovery.step';
import { MoatAnalysisStep } from './moat-analysis.step';
import { VerdictStep } from './verdict.step';

/**
 * The pipeline, as an ORDERED list. This is the single place that defines what the
 * research run does and in what order — add, remove, or reorder a stage here and the
 * orchestrator picks it up. Order must stay consistent with the RESEARCH_STEPS enum
 * (progress/SSE map to it), but each step is otherwise independent and pluggable.
 */
export const STEP_CLASSES: Type<PipelineStep>[] = [
  DecomposeStep,
  MarketResearchStep,
  CompetitorDiscoveryStep,
  MoatAnalysisStep,
  VerdictStep,
];

/** DI providers for the steps + a token exposing them as an ordered array. */
export const PIPELINE_STEPS = Symbol('PIPELINE_STEPS');

export const stepProviders: Provider[] = [
  ...STEP_CLASSES,
  {
    provide: PIPELINE_STEPS,
    useFactory: (...steps: PipelineStep[]): PipelineStep[] => steps,
    inject: STEP_CLASSES,
  },
];
