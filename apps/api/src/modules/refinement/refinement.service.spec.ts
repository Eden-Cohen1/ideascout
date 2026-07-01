import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LlmRegistry } from '../providers/llm/llm.registry';
import type { IdeasService } from '../ideas/ideas.service';
import { RefinementService } from './refinement.service';

function makeService(
  over: {
    message?: unknown[];
    idea?: unknown;
    run?: unknown;
  } = {},
) {
  const prisma = {
    refinementMessage: {
      findMany: jest.fn().mockResolvedValue(over.message ?? []),
    },
    idea: {
      findUnique: jest.fn().mockResolvedValue(
        over.idea ?? {
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        },
      ),
    },
    researchRun: { findFirst: jest.fn().mockResolvedValue(over.run ?? null) },
  } as unknown as PrismaService;
  const llm = { resolveForProject: jest.fn() } as unknown as LlmRegistry;
  const ideas = { update: jest.fn() } as unknown as IdeasService;
  return { service: new RefinementService(prisma, llm, ideas), prisma };
}

describe('RefinementService.listThread', () => {
  it('returns mapped messages oldest-first', async () => {
    const row = {
      id: 'm1',
      ideaId: 'idea1',
      role: 'USER',
      content: 'hi',
      proposedPatch: null,
      appliedVersionId: null,
      createdAt: new Date('2026-07-01T00:00:00Z'),
    };
    const { service, prisma } = makeService({ message: [row] });
    const out = await service.listThread('proj1', 'idea1');
    expect(out).toEqual([
      {
        id: 'm1',
        role: 'USER',
        content: 'hi',
        proposedPatch: null,
        appliedVersionId: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    expect((prisma.refinementMessage.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { ideaId: 'idea1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('404s when the idea is not in the project', async () => {
    const { service } = makeService({ idea: { id: 'idea1', projectId: 'OTHER' } });
    await expect(service.listThread('proj1', 'idea1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RefinementService.generate', () => {
  function collect(gen: AsyncIterable<{ type: string; delta?: string }>) {
    return (async () => {
      const events = [];
      for await (const e of gen) events.push(e);
      return events;
    })();
  }

  it('persists the user message, streams tokens, then persists + emits the assistant message', async () => {
    const created: Record<string, unknown>[] = [];
    const prisma = {
      idea: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        }),
      },
      researchRun: { findFirst: jest.fn().mockResolvedValue(null) },
      project: { findUnique: jest.fn().mockResolvedValue(null) },
      refinementMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: `m${created.length + 1}`,
            proposedPatch: null,
            appliedVersionId: null,
            createdAt: new Date('2026-07-01T00:00:00Z'),
            ...data,
          };
          created.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'm2',
            role: 'ASSISTANT',
            content: 'Hello there',
            appliedVersionId: null,
            createdAt: new Date('2026-07-01T00:00:00Z'),
            ...data,
          }),
        ),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;

    async function* fakeStream() {
      yield { delta: 'Hello ', done: false };
      yield { delta: 'there', done: false };
      yield { delta: '', done: true };
    }
    const provider = {
      defaultModel: 'mock-1',
      stream: jest.fn().mockReturnValue(fakeStream()),
      structured: jest.fn().mockResolvedValue({ value: {}, usage: {}, model: 'mock-1' }),
    };
    const llm = {
      resolveForProject: jest
        .fn()
        .mockReturnValue({ providerId: 'mock', provider, model: 'mock-1' }),
    } as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = {
      update: jest.fn(),
    } as unknown as import('../ideas/ideas.service').IdeasService;

    const service = new RefinementService(prisma, llm, ideas);
    const events = await collect(service.generate('proj1', 'idea1', 'hi'));

    const tokens = events.filter((e) => e.type === 'token').map((e) => e.delta);
    expect(tokens).toEqual(['Hello ', 'there']);
    const terminal = events.at(-1) as { type: string; message: { role: string; content: string } };
    expect(terminal.type).toBe('message');
    expect(terminal.message.role).toBe('ASSISTANT');
    expect(terminal.message.content).toBe('Hello there');

    // user message persisted first, assistant persisted after streaming
    expect((prisma.refinementMessage.create as jest.Mock).mock.calls[0][0].data.role).toBe('USER');
    expect((prisma.refinementMessage.create as jest.Mock).mock.calls[1][0].data.role).toBe(
      'ASSISTANT',
    );
  });

  it('persists the reply and emits a message frame even when patch extraction fails', async () => {
    const prisma = {
      idea: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        }),
      },
      researchRun: { findFirst: jest.fn().mockResolvedValue(null) },
      project: { findUnique: jest.fn().mockResolvedValue(null) },
      refinementMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'm1', role: 'USER', content: 'hi', createdAt: new Date() })
          .mockResolvedValueOnce({
            id: 'm2',
            role: 'ASSISTANT',
            content: 'Hello there',
            proposedPatch: null,
            appliedVersionId: null,
            createdAt: new Date('2026-07-01T00:00:00Z'),
          }),
        update: jest.fn(),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;

    async function* fakeStream() {
      yield { delta: 'Hello ', done: false };
      yield { delta: 'there', done: false };
      yield { delta: '', done: true };
    }
    const provider = {
      defaultModel: 'mock-1',
      stream: jest.fn().mockReturnValue(fakeStream()),
      // Extraction fails — must NOT discard the already-streamed reply.
      structured: jest.fn().mockRejectedValue(new Error('extraction boom')),
    };
    const llm = {
      resolveForProject: jest
        .fn()
        .mockReturnValue({ providerId: 'mock', provider, model: 'mock-1' }),
    } as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = {} as unknown as import('../ideas/ideas.service').IdeasService;

    const service = new RefinementService(prisma, llm, ideas);
    const events = await collect(service.generate('proj1', 'idea1', 'hi'));

    const terminal = events.at(-1) as {
      type: string;
      message: { content: string; proposedPatch: unknown };
    };
    expect(terminal.type).toBe('message'); // NOT 'error'
    expect(terminal.message.content).toBe('Hello there');
    expect(terminal.message.proposedPatch).toBeNull();
    // the ASSISTANT reply was persisted despite extraction failing
    expect((prisma.refinementMessage.create as jest.Mock).mock.calls[1][0].data).toMatchObject({
      role: 'ASSISTANT',
      content: 'Hello there',
    });
    // no proposedPatch update happened (extraction produced nothing)
    expect(prisma.refinementMessage.update as jest.Mock).not.toHaveBeenCalled();
  });

  it('emits an error frame when streaming throws', async () => {
    const prisma = {
      idea: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'idea1',
          projectId: 'proj1',
          currentVersion: { problem: 'p', solution: 's', targetCustomer: null },
        }),
      },
      researchRun: { findFirst: jest.fn().mockResolvedValue(null) },
      project: { findUnique: jest.fn().mockResolvedValue(null) },
      refinementMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'm1',
          role: 'USER',
          content: 'hi',
          proposedPatch: null,
          appliedVersionId: null,
          createdAt: new Date(),
        }),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;
    async function* boom() {
      yield { delta: 'x', done: false };
      throw new Error('stream died');
    }
    const provider = { defaultModel: 'mock-1', stream: jest.fn().mockReturnValue(boom()) };
    const llm = {
      resolveForProject: jest
        .fn()
        .mockReturnValue({ providerId: 'mock', provider, model: 'mock-1' }),
    } as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = {} as unknown as import('../ideas/ideas.service').IdeasService;

    const service = new RefinementService(prisma, llm, ideas);
    const events = [];
    for await (const e of service.generate('proj1', 'idea1', 'hi')) events.push(e);
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });
});

describe('RefinementService.applyPatch', () => {
  function base(messageRow: unknown) {
    const prisma = {
      idea: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'idea1', projectId: 'proj1', currentVersion: {} }),
      },
      refinementMessage: {
        findUnique: jest.fn().mockResolvedValue(messageRow),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('../../prisma/prisma.service').PrismaService;
    const llm = {} as unknown as import('../providers/llm/llm.registry').LlmRegistry;
    const ideas = {
      update: jest
        .fn()
        .mockResolvedValue({ id: 'idea1', currentVersionId: 'v2', currentVersion: { id: 'v2' } }),
    } as unknown as import('../ideas/ideas.service').IdeasService;
    return { service: new RefinementService(prisma, llm, ideas), prisma, ideas };
  }

  it('creates a new version from the patch and links appliedVersionId', async () => {
    const { service, prisma, ideas } = base({
      id: 'm2',
      ideaId: 'idea1',
      proposedPatch: { problem: 'sharper problem' },
      appliedVersionId: null,
    });
    const result = await service.applyPatch('proj1', 'idea1', 'm2');
    expect(ideas.update as jest.Mock).toHaveBeenCalledWith('proj1', 'idea1', {
      problem: 'sharper problem',
    });
    expect((prisma.refinementMessage.update as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 'm2' },
      data: { appliedVersionId: 'v2' },
    });
    expect(result.currentVersionId).toBe('v2');
  });

  it('rejects a message with no proposed patch', async () => {
    const { service } = base({
      id: 'm3',
      ideaId: 'idea1',
      proposedPatch: null,
      appliedVersionId: null,
    });
    await expect(service.applyPatch('proj1', 'idea1', 'm3')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an already-applied message', async () => {
    const { service } = base({
      id: 'm2',
      ideaId: 'idea1',
      proposedPatch: { problem: 'x' },
      appliedVersionId: 'v9',
    });
    await expect(service.applyPatch('proj1', 'idea1', 'm2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404s when the message belongs to another idea', async () => {
    const { service } = base({
      id: 'm2',
      ideaId: 'OTHER',
      proposedPatch: { problem: 'x' },
      appliedVersionId: null,
    });
    await expect(service.applyPatch('proj1', 'idea1', 'm2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
