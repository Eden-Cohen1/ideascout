import type { ResearchRun } from '@prisma/client';
import type { LlmProvider } from '../../modules/providers/llm/llm-provider.interface';
import type { ResearchProvider } from '../../modules/providers/research/research-provider.interface';
import { MockLlmProvider } from '../../modules/providers/llm/adapters/mock.adapter';
import { MockResearchProvider } from '../../modules/providers/research/adapters/mock.adapter';
import type { IdeaInput, ResearchContext } from '../pipeline.types';

/** A deterministic context for step unit tests, mocks by default. */
export function makeContext(over: Partial<ResearchContext> = {}): ResearchContext {
  const idea: IdeaInput = {
    title: 'Acme',
    problem: 'X is hard',
    solution: 'We make X easy',
    targetCustomer: 'SMBs',
  };
  return {
    run: { id: 'run1', llmModel: 'mock-1' } as unknown as ResearchRun,
    idea,
    llm: new MockLlmProvider() as LlmProvider,
    research: new MockResearchProvider() as ResearchProvider,
    questions: [],
    pages: [],
    ...over,
  };
}
