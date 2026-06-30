import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import type { PrismaService } from '../../prisma/prisma.service';

function prismaWith(project: Record<string, unknown>): PrismaService {
  return { project } as unknown as PrismaService;
}

describe('ProjectsService', () => {
  it('creates a project owned by the user', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p1' });
    const svc = new ProjectsService(prismaWith({ create }));
    await svc.create('u1', { name: 'My SaaS', description: 'desc' });
    expect(create).toHaveBeenCalledWith({
      data: { ownerId: 'u1', name: 'My SaaS', description: 'desc' },
    });
  });

  it('defaults a missing description to null', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p1' });
    const svc = new ProjectsService(prismaWith({ create }));
    await svc.create('u1', { name: 'X' });
    expect(create).toHaveBeenCalledWith({ data: { ownerId: 'u1', name: 'X', description: null } });
  });

  it('lists the owner projects newest-first', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = new ProjectsService(prismaWith({ findMany }));
    await svc.listForOwner('u1');
    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getById throws NotFound when the project is missing', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const svc = new ProjectsService(prismaWith({ findUnique }));
    await expect(svc.getById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a project by id', async () => {
    const del = jest.fn().mockResolvedValue({ id: 'p1' });
    const svc = new ProjectsService(prismaWith({ delete: del }));
    await svc.remove('p1');
    expect(del).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});
