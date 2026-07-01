import {
  PatchExtractionSchema,
  REFINEMENT_SYSTEM_PROMPT,
  patchExtractionMessages,
} from './refinement.prompt';

describe('refinement.prompt', () => {
  it('system prompt describes the advisor role', () => {
    expect(REFINEMENT_SYSTEM_PROMPT.toLowerCase()).toContain('advisor');
  });

  it('patch extraction messages include the reply and idea brief', () => {
    const msgs = patchExtractionMessages('Problem: X', 'You should narrow the audience.');
    expect(msgs[0].role).toBe('system');
    expect(msgs.at(-1)?.content).toContain('narrow the audience');
    expect(msgs.at(-1)?.content).toContain('Problem: X');
  });

  it('PatchExtractionSchema allows an empty object (no proposed changes)', () => {
    expect(PatchExtractionSchema.parse({})).toEqual({});
  });

  it('PatchExtractionSchema keeps provided fields', () => {
    expect(PatchExtractionSchema.parse({ problem: 'new' }).problem).toBe('new');
  });
});
