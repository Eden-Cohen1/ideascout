import { z } from 'zod';
import { zodToOpenApi } from './swagger';

interface OpenApiObject {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

describe('zodToOpenApi', () => {
  it('converts a Zod object into an OpenAPI 3 schema', () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().int().optional() });
    const out = zodToOpenApi(schema) as OpenApiObject;
    expect(out.type).toBe('object');
    expect(out.properties).toHaveProperty('name');
    expect(out.required).toContain('name');
    expect(out.required).not.toContain('age');
  });

  it('inlines nested schemas (no $ref, for clean Swagger rendering)', () => {
    const inner = z.object({ x: z.string() });
    const schema = z.object({ a: inner, b: inner });
    expect(JSON.stringify(zodToOpenApi(schema))).not.toContain('$ref');
  });
});
