import { describe, expect, it } from 'vitest';
import { canTransition, nextStates, LIFECYCLE_TRANSITIONS } from './lifecycle';
import { IDEA_LIFECYCLE_STATES } from './enums';

describe('lifecycle transitions', () => {
  it('allows the forward path IDEA -> RESEARCH -> REFINE -> VALIDATE -> DECISION', () => {
    expect(canTransition('IDEA', 'RESEARCH')).toBe(true);
    expect(canTransition('RESEARCH', 'REFINE')).toBe(true);
    expect(canTransition('REFINE', 'VALIDATE')).toBe(true);
    expect(canTransition('VALIDATE', 'DECISION')).toBe(true);
  });

  it('allows iterating back to research from refine and reopening a decision', () => {
    expect(canTransition('REFINE', 'RESEARCH')).toBe(true);
    expect(canTransition('VALIDATE', 'REFINE')).toBe(true);
    expect(canTransition('DECISION', 'REFINE')).toBe(true);
  });

  it('allows an early no-go straight to DECISION from RESEARCH', () => {
    expect(canTransition('RESEARCH', 'DECISION')).toBe(true);
  });

  it('forbids skipping stages', () => {
    expect(canTransition('IDEA', 'VALIDATE')).toBe(false);
    expect(canTransition('IDEA', 'DECISION')).toBe(false);
  });

  it('forbids a no-op transition to the same state', () => {
    expect(canTransition('REFINE', 'REFINE')).toBe(false);
  });

  it('exposes the allowed next states', () => {
    expect(nextStates('IDEA')).toEqual(['RESEARCH']);
  });

  it('defines transitions for every lifecycle state', () => {
    for (const state of IDEA_LIFECYCLE_STATES) {
      expect(LIFECYCLE_TRANSITIONS[state]).toBeDefined();
    }
  });
});
