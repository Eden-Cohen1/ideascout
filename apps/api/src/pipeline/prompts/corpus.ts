import type { IdeaInput } from '../pipeline.types';
import type { FetchedPage } from '../../modules/providers/research/research-provider.interface';

/** One-paragraph description of the idea, shared by every LLM prompt. */
export function ideaBrief(idea: IdeaInput): string {
  const lines = [`Title: ${idea.title}`, `Problem: ${idea.problem}`, `Solution: ${idea.solution}`];
  if (idea.targetCustomer) {
    lines.push(`Target customer: ${idea.targetCustomer}`);
  }
  return lines.join('\n');
}

/**
 * Render the fetched corpus as a numbered, source-tagged block. Every LLM extraction
 * prompt includes this and is instructed to cite ONLY these URLs — grounding is then
 * enforced structurally (see citation-grounding.ts), but showing the allowed sources
 * keeps the model honest up front. Content is truncated to keep the prompt bounded.
 */
export function renderCorpus(pages: FetchedPage[], perPageChars = 1500): string {
  const usable = pages.filter((p) => p.status === 'ok');
  if (usable.length === 0) {
    return '(no sources were retrieved)';
  }
  return usable
    .map((p, i) => {
      const body = p.content.slice(0, perPageChars);
      return `[${i + 1}] ${p.title ?? p.url}\nURL: ${p.url}\n${body}`;
    })
    .join('\n\n---\n\n');
}

/** The list of URLs an LLM is permitted to cite for this run. */
export function allowedSourceUrls(pages: FetchedPage[]): string[] {
  return pages.filter((p) => p.status === 'ok').map((p) => p.url);
}
