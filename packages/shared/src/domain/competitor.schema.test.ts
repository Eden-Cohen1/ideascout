import { describe, expect, it } from 'vitest';
import { CompetitorSchema, CompetitorMapSchema } from './competitor.schema';

describe('CompetitorSchema', () => {
  const valid = {
    name: 'Acme',
    url: 'https://acme.example',
    product: 'A widget platform',
    customer: 'Mid-market ops teams',
    positioning: 'Affordable all-in-one',
    pricingNotes: 'From $20/seat',
    strengths: ['brand'],
    weaknesses: ['slow support'],
    citations: [{ url: 'https://acme.example/about', title: 'About Acme' }],
  };

  it('parses a valid competitor', () => {
    expect(CompetitorSchema.parse(valid)).toMatchObject({ name: 'Acme' });
  });

  it('requires product and customer', () => {
    const { product: _p, ...noProduct } = valid;
    expect(() => CompetitorSchema.parse(noProduct)).toThrow();
    const { customer: _c, ...noCustomer } = valid;
    expect(() => CompetitorSchema.parse(noCustomer)).toThrow();
  });

  it('defaults strengths and weaknesses to empty arrays', () => {
    const minimal = {
      name: 'Beta',
      product: 'p',
      customer: 'c',
      citations: [],
    };
    const parsed = CompetitorSchema.parse(minimal);
    expect(parsed.strengths).toEqual([]);
    expect(parsed.weaknesses).toEqual([]);
  });

  it('rejects a non-URL url when present', () => {
    expect(() => CompetitorSchema.parse({ ...valid, url: 'acme' })).toThrow();
  });
});

describe('CompetitorMapSchema', () => {
  it('parses a map and defaults segments to []', () => {
    const parsed = CompetitorMapSchema.parse({
      marketSummary: 'Crowded but fragmented.',
      competitors: [{ name: 'Acme', product: 'p', customer: 'c', citations: [] }],
    });
    expect(parsed.segments).toEqual([]);
    expect(parsed.competitors).toHaveLength(1);
  });
});
