import { NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ProjectAccessGuard } from './project-access.guard';
import type { PrismaService } from '../../prisma/prisma.service';

function makeGuard(findUnique: jest.Mock): ProjectAccessGuard {
  const prisma = { project: { findUnique } } as unknown as PrismaService;
  return new ProjectAccessGuard(prisma);
}

function ctx(req: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('ProjectAccessGuard', () => {
  it('allows the owner and attaches the project to the request', async () => {
    const project = { id: 'p1', ownerId: 'u1' };
    const guard = makeGuard(jest.fn().mockResolvedValue(project));
    const req: Record<string, unknown> = { user: { id: 'u1' }, params: { id: 'p1' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.project).toBe(project);
  });

  it('denies a non-owner with NotFound (no existence leak)', async () => {
    const guard = makeGuard(jest.fn().mockResolvedValue({ id: 'p1', ownerId: 'someone-else' }));
    const req = { user: { id: 'u1' }, params: { id: 'p1' } };
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the project does not exist', async () => {
    const guard = makeGuard(jest.fn().mockResolvedValue(null));
    const req = { user: { id: 'u1' }, params: { id: 'p1' } };
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves the project id from a :projectId param too', async () => {
    const project = { id: 'p9', ownerId: 'u1' };
    const findUnique = jest.fn().mockResolvedValue(project);
    const guard = makeGuard(findUnique);
    const req = { user: { id: 'u1' }, params: { projectId: 'p9' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'p9' } });
  });

  it('throws Unauthorized when no authenticated user is present', async () => {
    const guard = makeGuard(jest.fn());
    const req = { params: { id: 'p1' } };
    await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
