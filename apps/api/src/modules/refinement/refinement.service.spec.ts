import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { RefinementService } from './refinement.service';

function makeService(over: {
  message?: unknown[];
  idea?: unknown;
} = {}) {
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
  } as unknown as PrismaService;
  return { service: new RefinementService(prisma), prisma };
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
