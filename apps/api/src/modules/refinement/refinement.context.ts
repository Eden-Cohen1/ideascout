import type { LlmMessage, LlmRole } from '../providers/llm/llm-provider.interface';
import { REFINEMENT_SYSTEM_PROMPT } from './refinement.prompt';

export interface IdeaSnapshot {
  problem: string;
  solution: string;
  targetCustomer: string | null;
}

export interface ResearchSummary {
  verdict: string;
  score: number | null;
  keyRisks: string[];
  marketSummary?: string;
  moatSummary?: string;
}

export interface HistoryTurn {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

/** Compact description of the current idea, shared by the chat + patch-extraction prompts. */
export function ideaBrief(idea: IdeaSnapshot): string {
  const lines = [`Problem: ${idea.problem}`, `Solution: ${idea.solution}`];
  if (idea.targetCustomer) lines.push(`Target customer: ${idea.targetCustomer}`);
  return lines.join('\n');
}

function researchBlock(research: ResearchSummary): string {
  const lines = [
    `Verdict: ${research.verdict}${research.score !== null ? ` (score ${research.score}/100)` : ''}`,
  ];
  if (research.keyRisks.length) lines.push(`Key risks: ${research.keyRisks.join('; ')}`);
  if (research.marketSummary) lines.push(`Market: ${research.marketSummary}`);
  if (research.moatSummary) lines.push(`Moat: ${research.moatSummary}`);
  return lines.join('\n');
}

const ROLE_MAP: Record<HistoryTurn['role'], LlmRole> = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

/**
 * Keep only completed USER→ASSISTANT exchanges, dropping orphaned user turns (a turn
 * whose generation failed persists the user message but no reply). This keeps the
 * history strictly alternating — a dangling user turn would both mislead the model and
 * break providers (e.g. Anthropic) that require alternating roles once the new user
 * turn is appended.
 */
export function toAlternatingHistory(turns: HistoryTurn[]): HistoryTurn[] {
  const pairs: HistoryTurn[] = [];
  for (let i = 0; i < turns.length; i += 1) {
    if (turns[i].role === 'USER' && turns[i + 1]?.role === 'ASSISTANT') {
      pairs.push(turns[i], turns[i + 1]);
      i += 1; // consume the assistant reply
    }
  }
  return pairs;
}

/** Assemble the chat context: system (persona + idea + research) → history → new user turn. */
export function buildRefinementContext(
  idea: IdeaSnapshot,
  research: ResearchSummary | null,
  history: HistoryTurn[],
  userMessage: string,
): LlmMessage[] {
  const systemParts = [REFINEMENT_SYSTEM_PROMPT, `=== IDEA ===\n${ideaBrief(idea)}`];
  if (research) systemParts.push(`=== RESEARCH FINDINGS ===\n${researchBlock(research)}`);

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    ...toAlternatingHistory(history).map((t) => ({ role: ROLE_MAP[t.role], content: t.content })),
    { role: 'user', content: userMessage },
  ];
}
