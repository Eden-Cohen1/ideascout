// Cross-cutting enums. Kept as `as const` tuples so they double as runtime values
// (e.g. for Zod `z.enum(...)`) and as derived string-literal union types.
// These mirror the Prisma enums in apps/api/prisma/schema.prisma — keep them in sync.

export const IDEA_LIFECYCLE_STATES = [
  'IDEA',
  'RESEARCH',
  'REFINE',
  'VALIDATE',
  'DECISION',
] as const;
export type IdeaLifecycleState = (typeof IDEA_LIFECYCLE_STATES)[number];

export const RESEARCH_RUN_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;
export type ResearchRunStatus = (typeof RESEARCH_RUN_STATUSES)[number];

export const RESEARCH_STEPS = [
  'DECOMPOSE',
  'MARKET_RESEARCH',
  'COMPETITOR_DISCOVERY',
  'MOAT_ANALYSIS',
  'VERDICT',
] as const;
export type ResearchStep = (typeof RESEARCH_STEPS)[number];

export const VERDICTS = ['GO', 'NO_GO', 'CONDITIONAL_GO'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const REFINEMENT_ROLES = ['USER', 'ASSISTANT', 'SYSTEM'] as const;
export type RefinementRole = (typeof REFINEMENT_ROLES)[number];
