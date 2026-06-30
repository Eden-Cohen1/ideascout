import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../config/config.service';
import type {
  FetchedPage,
  ResearchProvider,
  SearchQuery,
  SearchResult,
} from '../research-provider.interface';

interface TavilyResponse {
  results?: { title?: string; url?: string; content?: string; published_date?: string }[];
}

const MAX_CONTENT = 12_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class TavilyResearchProvider implements ResearchProvider {
  readonly id = 'tavily';

  constructor(private readonly config: AppConfigService) {}

  isAvailable(): boolean {
    return this.config.providerKey('tavily') !== undefined;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const res = await globalThis.fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.providerKey('tavily')}`,
      },
      body: JSON.stringify({
        query: query.query,
        max_results: query.maxResults ?? 5,
        search_depth: 'basic',
      }),
    });
    if (!res.ok) {
      throw new Error(`tavily search failed (${res.status})`);
    }
    const data = (await res.json()) as TavilyResponse;
    return (data.results ?? []).map((r, i) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
      publishedAt: r.published_date,
      rank: i + 1,
    }));
  }

  async fetch(url: string): Promise<FetchedPage> {
    const fetchedAt = new Date().toISOString();
    try {
      const res = await globalThis.fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        const status = res.status === 403 || res.status === 429 ? 'blocked' : 'error';
        return { url, content: '', fetchedAt, status };
      }
      const html = await res.text();
      return { url, content: stripHtml(html).slice(0, MAX_CONTENT), fetchedAt, status: 'ok' };
    } catch {
      return { url, content: '', fetchedAt, status: 'error' };
    }
  }
}
