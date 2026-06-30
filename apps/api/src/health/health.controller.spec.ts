import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

function makeController(query: () => Promise<unknown>): HealthController {
  const prisma = { $queryRaw: jest.fn(query) } as unknown as PrismaService;
  return new HealthController(prisma);
}

describe('HealthController', () => {
  it('reports an ok liveness status', () => {
    const controller = makeController(() => Promise.resolve([{ ok: 1 }]));
    expect(controller.check()).toEqual({ status: 'ok', service: 'ideascout-api' });
  });

  it('reports ready when the database responds', async () => {
    const controller = makeController(() => Promise.resolve([{ ok: 1 }]));
    await expect(controller.ready()).resolves.toEqual({ status: 'ready', db: 'up' });
  });

  it('throws ServiceUnavailable when the database is unreachable', async () => {
    const controller = makeController(() => Promise.reject(new Error('no db')));
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
