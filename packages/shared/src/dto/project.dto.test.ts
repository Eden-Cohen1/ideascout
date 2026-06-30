import { describe, expect, it } from 'vitest';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  ProjectResponseSchema,
} from './project.dto';

describe('CreateProjectRequestSchema', () => {
  it('requires a non-empty name', () => {
    expect(() => CreateProjectRequestSchema.parse({ name: '' })).toThrow();
    expect(() => CreateProjectRequestSchema.parse({})).toThrow();
  });

  it('parses with name only (description optional)', () => {
    expect(CreateProjectRequestSchema.parse({ name: 'My SaaS' })).toEqual({ name: 'My SaaS' });
  });
});

describe('UpdateProjectRequestSchema', () => {
  it('allows an empty patch', () => {
    expect(() => UpdateProjectRequestSchema.parse({})).not.toThrow();
  });

  it('accepts provider selection fields', () => {
    const parsed = UpdateProjectRequestSchema.parse({ llmProvider: 'anthropic', llmModel: 'x' });
    expect(parsed.llmProvider).toBe('anthropic');
  });
});

describe('ProjectResponseSchema', () => {
  it('parses a project response', () => {
    const parsed = ProjectResponseSchema.parse({
      id: 'p1',
      ownerId: 'u1',
      name: 'My SaaS',
      description: null,
      llmProvider: null,
      llmModel: null,
      researchProvider: null,
      createdAt: '2026-06-30T00:00:00.000Z',
      updatedAt: '2026-06-30T00:00:00.000Z',
    });
    expect(parsed.id).toBe('p1');
  });
});
