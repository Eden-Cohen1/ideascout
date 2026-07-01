import type { Citation } from '@ideascout/shared';
import type { FetchedPage } from '../modules/providers/research/research-provider.interface';
import { groundCitations } from './citation-grounding';

const page = (url: string, status: FetchedPage['status'] = 'ok'): FetchedPage => ({
  url,
  title: 'P',
  content: 'c',
  fetchedAt: '1970-01-01T00:00:00.000Z',
  status,
});

const cite = (url: string): Citation => ({ url, title: 'T' });

describe('groundCitations', () => {
  const pages = [page('https://a.com'), page('https://b.com')];

  it('keeps citations whose url was actually fetched', () => {
    const result = groundCitations([cite('https://a.com'), cite('https://b.com')], pages);
    expect(result.map((c) => c.url)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('drops citations pointing at pages that were never fetched (anti-hallucination)', () => {
    const result = groundCitations([cite('https://a.com'), cite('https://evil.com')], pages);
    expect(result.map((c) => c.url)).toEqual(['https://a.com']);
  });

  it('ignores pages that failed to fetch when grounding', () => {
    const result = groundCitations(
      [cite('https://blocked.com')],
      [page('https://blocked.com', 'blocked')],
    );
    expect(result).toEqual([]);
  });

  it('normalizes trailing slashes so url variants still match', () => {
    const result = groundCitations([cite('https://a.com/')], pages);
    expect(result).toHaveLength(1);
  });

  it('dedupes repeated citations to the same source', () => {
    const result = groundCitations([cite('https://a.com'), cite('https://a.com')], pages);
    expect(result).toHaveLength(1);
  });
});
