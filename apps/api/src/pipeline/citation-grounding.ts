import type { Citation } from '@ideascout/shared';
import type { FetchedPage } from '../modules/providers/research/research-provider.interface';

/**
 * Citation grounding: the pipeline NEVER trusts an LLM's claimed source. A citation
 * survives only if its URL matches a page that was actually fetched (status 'ok')
 * during this run. This is the structural defense against fabricated sources — see
 * the contract note on `CitationSchema` in @ideascout/shared.
 */

/** Canonical form for comparison: lowercase host, no trailing slash, no hash. */
function canonical(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    const normalized = u.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

function fetchedUrlSet(pages: FetchedPage[]): Set<string> {
  return new Set(pages.filter((p) => p.status === 'ok').map((p) => canonical(p.url)));
}

/** Filter citations to those grounded in the fetched corpus, deduped by canonical url. */
export function groundCitations(citations: Citation[], pages: FetchedPage[]): Citation[] {
  const allowed = fetchedUrlSet(pages);
  const seen = new Set<string>();
  const grounded: Citation[] = [];
  for (const citation of citations) {
    const key = canonical(citation.url);
    if (!allowed.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    grounded.push(citation);
  }
  return grounded;
}
