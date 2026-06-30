import { type IdeaLifecycleState } from './enums';

/**
 * Allowed idea lifecycle transitions. The forward path is
 * IDEA → RESEARCH → REFINE → VALIDATE → DECISION, with iteration back to RESEARCH
 * from REFINE, REFINE from VALIDATE/DECISION (reopen), and an early no-go to
 * DECISION from RESEARCH. No-op (same-state) transitions are not allowed.
 */
export const LIFECYCLE_TRANSITIONS: Record<IdeaLifecycleState, IdeaLifecycleState[]> = {
  IDEA: ['RESEARCH'],
  RESEARCH: ['REFINE', 'DECISION'],
  REFINE: ['RESEARCH', 'VALIDATE'],
  VALIDATE: ['DECISION', 'REFINE'],
  DECISION: ['REFINE'],
};

export function nextStates(from: IdeaLifecycleState): IdeaLifecycleState[] {
  return LIFECYCLE_TRANSITIONS[from];
}

export function canTransition(from: IdeaLifecycleState, to: IdeaLifecycleState): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}
