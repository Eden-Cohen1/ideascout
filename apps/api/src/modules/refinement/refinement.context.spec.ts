import { buildRefinementContext, ideaBrief } from './refinement.context';

const idea = { problem: 'Founders waste time', solution: 'AI evaluator', targetCustomer: 'Solo founders' };

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
      { verdict: 'CONDITIONAL_GO', score: 55, keyRisks: ['Crowded market'], marketSummary: 'Busy space', moatSummary: 'Thin moat' },
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
});
