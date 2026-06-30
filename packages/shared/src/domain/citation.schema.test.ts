import { describe, expect, it } from 'vitest';
import { CitationSchema } from './citation.schema';

describe('CitationSchema', () => {
  const valid = {
    url: 'https://example.com/article',
    title: 'Example article',
    quote: 'A short supporting snippet.',
  };

  it('parses a valid citation', () => {
    expect(CitationSchema.parse(valid)).toEqual(valid);
  });

  it('treats quote as optional', () => {
    const { quote: _quote, ...withoutQuote } = valid;
    expect(CitationSchema.parse(withoutQuote)).toEqual(withoutQuote);
  });

  it('rejects a non-URL url', () => {
    expect(() => CitationSchema.parse({ ...valid, url: 'not-a-url' })).toThrow();
  });

  it('rejects a missing title', () => {
    const { title: _title, ...withoutTitle } = valid;
    expect(() => CitationSchema.parse(withoutTitle)).toThrow();
  });

  it('rejects a quote longer than 500 characters', () => {
    expect(() => CitationSchema.parse({ ...valid, quote: 'x'.repeat(501) })).toThrow();
  });
});
