export interface SearchQuery {
  query: string;
  maxResults?: number;
  freshnessDays?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  rank: number;
}

export interface FetchedPage {
  url: string;
  title?: string;
  /** Cleaned main text, truncated to a token budget. */
  content: string;
  fetchedAt: string;
  status: 'ok' | 'blocked' | 'error';
}

/** Stable contract for web-research backends (Tavily + Mock; Brave/Serp later). */
export interface ResearchProvider {
  readonly id: string;
  isAvailable(): boolean;
  search(query: SearchQuery): Promise<SearchResult[]>;
  fetch(url: string): Promise<FetchedPage>;
}
