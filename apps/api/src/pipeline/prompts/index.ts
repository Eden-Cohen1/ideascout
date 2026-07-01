import type { LlmMessage } from '../../modules/providers/llm/llm-provider.interface';
import type { FetchedPage } from '../../modules/providers/research/research-provider.interface';
import type { IdeaInput } from '../pipeline.types';
import { allowedSourceUrls, ideaBrief, renderCorpus } from './corpus';

/**
 * Prompt builders, one per LLM-backed step. Kept apart from step logic so prompts can
 * be tuned (or A/B'd) without touching control flow. Each returns chat messages for
 * `LlmProvider.structured(...)`; the matching Zod schema does the output contract.
 */

const ANALYST_SYSTEM =
  'You are a rigorous startup analyst. Be specific, skeptical, and evidence-driven. ' +
  'When sources are provided, ground every claim in them and cite only the given URLs. ' +
  'Never invent sources, companies, or statistics.';

function system(extra?: string): LlmMessage {
  return { role: 'system', content: extra ? `${ANALYST_SYSTEM}\n${extra}` : ANALYST_SYSTEM };
}

function sourcesFooter(pages: FetchedPage[]): string {
  return `\n\nAllowed citation URLs (cite only these, verbatim):\n${allowedSourceUrls(pages)
    .map((u) => `- ${u}`)
    .join('\n')}`;
}

export function decomposePrompt(idea: IdeaInput): LlmMessage[] {
  return [
    system(),
    {
      role: 'user',
      content:
        `Break this startup idea into 4-6 focused web-research questions that, answered, ` +
        `would tell us whether it is worth pursuing (market size, competitors, demand, ` +
        `feasibility, moat). Return them as a JSON object.\n\n${ideaBrief(idea)}`,
    },
  ];
}

export function competitorPrompt(idea: IdeaInput, pages: FetchedPage[]): LlmMessage[] {
  return [
    system(),
    {
      role: 'user',
      content:
        `Using ONLY the sources below, build a competitor map for this idea: who else ` +
        `serves this problem, what they sell, to whom, and their strengths/weaknesses. ` +
        `Include a market summary and segments. Cite sources.\n\n` +
        `=== IDEA ===\n${ideaBrief(idea)}\n\n=== SOURCES ===\n${renderCorpus(pages)}` +
        sourcesFooter(pages),
    },
  ];
}

export function moatPrompt(idea: IdeaInput, pages: FetchedPage[]): LlmMessage[] {
  return [
    system(),
    {
      role: 'user',
      content:
        `Assess this idea's defensibility across the standard moat dimensions ` +
        `(network effects, switching costs, IP/intangibles, cost advantage, data, brand, ` +
        `economies of scale). For each, say whether it is present, score its strength 0-100, ` +
        `and justify. Give an overall defensibility score and the main risks. Cite sources.\n\n` +
        `=== IDEA ===\n${ideaBrief(idea)}\n\n=== SOURCES ===\n${renderCorpus(pages)}` +
        sourcesFooter(pages),
    },
  ];
}

export function verdictPrompt(idea: IdeaInput, pages: FetchedPage[]): LlmMessage[] {
  return [
    system(),
    {
      role: 'user',
      content:
        `Make a GO / NO_GO / CONDITIONAL_GO recommendation for this idea, grounded in the ` +
        `sources and the analysis so far. Provide a 0-100 score, a summary, weighted reasons ` +
        `(positive/negative/neutral), key risks, and any conditions for a CONDITIONAL_GO. ` +
        `Cite sources.\n\n=== IDEA ===\n${ideaBrief(idea)}\n\n=== SOURCES ===\n` +
        `${renderCorpus(pages)}${sourcesFooter(pages)}`,
    },
  ];
}
