import { Injectable } from '@nestjs/common';
import type {
  FetchedPage,
  ResearchProvider,
  SearchQuery,
  SearchResult,
} from '../research-provider.interface';

/** Deterministic mock research backend. Always available (registry fallback). */
@Injectable()
export class MockResearchProvider implements ResearchProvider {
  readonly id = 'mock';

  isAvailable(): boolean {
    return true;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const count = Math.min(query.maxResults ?? 3, 5);
    return Array.from({ length: count }, (_unused, i) => ({
      title: `Mock result ${i + 1} for "${query.query}"`,
      url: `https://example.com/mock/${encodeURIComponent(query.query)}/${i + 1}`,
      snippet: `Mock snippet ${i + 1} about ${query.query}.`,
      rank: i + 1,
    }));
  }

  async fetch(url: string): Promise<FetchedPage> {
    return {
      url,
      title: 'Mock page',
      content: `Mock page content for ${url}. Lorem ipsum about the topic.`,
      fetchedAt: '1970-01-01T00:00:00.000Z',
      status: 'ok',
    };
  }
}
