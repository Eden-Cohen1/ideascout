import { buildRefinementContext, ideaBrief, toAlternatingHistory } from './refinement.context';

const idea = {
  problem: 'Founders waste time',
  solution: 'AI evaluator',
  targetCustomer: 'Solo founders',
};

describe('refinement.context', () => {
  it('ideaBrief includes all present fields', () => {
    const brief = ideaBrief(idea);
    expect(brief).toContain('Founders waste time');
    expect(brief).toContain('Solo founders');
  });

  it('starts with a system message and ends with the user message', () => {
    const msgs = buildRefinementContext(idea, null, [], 'Should I narrow the market?');
    expect(msgs[0].role).toBe('system');
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'Should I narrow the market?' });
  });

  it('includes the research summary in the system message when present', () => {
    const msgs = buildRefinementContext(
      idea,
      {
        verdict: 'CONDITIONAL_GO',
        score: 55,
        keyRisks: ['Crowded market'],
        marketSummary: 'Busy space',
        moatSummary: 'Thin moat',
      },
      [],
      'hi',
    );
    expect(msgs[0].content).toContain('CONDITIONAL_GO');
    expect(msgs[0].content).toContain('Crowded market');
    expect(msgs[0].content).toContain('Busy space');
  });

  it('maps history turns to chat roles in order', () => {
    const msgs = buildRefinementContext(
      idea,
      null,
      [
        { role: 'USER', content: 'first' },
        { role: 'ASSISTANT', content: 'reply' },
      ],
      'second',
    );
    const roles = msgs.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('drops an orphaned trailing user turn so roles stay alternating', () => {
    // A failed prior generation leaves a user turn with no assistant reply.
    const msgs = buildRefinementContext(
      idea,
      null,
      [
        { role: 'USER', content: 'q1' },
        { role: 'ASSISTANT', content: 'a1' },
        { role: 'USER', content: 'q2-that-failed' },
      ],
      'q3',
    );
    const roles = msgs.map((m) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'user']); // q2 dropped, ends with q3
    expect(msgs.map((m) => m.content)).not.toContain('q2-that-failed');
  });
});

describe('toAlternatingHistory', () => {
  it('keeps completed USER→ASSISTANT pairs', () => {
    const out = toAlternatingHistory([
      { role: 'USER', content: 'u1' },
      { role: 'ASSISTANT', content: 'a1' },
      { role: 'USER', content: 'u2' },
      { role: 'ASSISTANT', content: 'a2' },
    ]);
    expect(out.map((t) => t.content)).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  it('drops an orphaned user turn in the middle', () => {
    const out = toAlternatingHistory([
      { role: 'USER', content: 'u1' },
      { role: 'USER', content: 'orphan' },
      { role: 'ASSISTANT', content: 'a1' },
    ]);
    // u1 has no immediate assistant; the completed pair is orphan→a1.
    expect(out.map((t) => t.content)).toEqual(['orphan', 'a1']);
  });

  it('drops a trailing orphaned user turn', () => {
    const out = toAlternatingHistory([
      { role: 'USER', content: 'u1' },
      { role: 'ASSISTANT', content: 'a1' },
      { role: 'USER', content: 'orphan' },
    ]);
    expect(out.map((t) => t.content)).toEqual(['u1', 'a1']);
  });

  it('returns nothing for a lone user turn', () => {
    expect(toAlternatingHistory([{ role: 'USER', content: 'u1' }])).toEqual([]);
  });
});
