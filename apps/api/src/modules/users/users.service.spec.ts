import { UsersService } from './users.service';
import type { PrismaService } from '../../prisma/prisma.service';

function prismaWith(user: Record<string, unknown>): PrismaService {
  return { user } as unknown as PrismaService;
}

describe('UsersService', () => {
  it('finds a user by email', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    const svc = new UsersService(prismaWith({ findUnique }));
    await svc.findByEmail('a@b.com');
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  it('finds a user by id', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    const svc = new UsersService(prismaWith({ findUnique }));
    await svc.findById('u1');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('creates a user', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'u1' });
    const svc = new UsersService(prismaWith({ create }));
    await svc.create({ email: 'a@b.com', passwordHash: 'h', displayName: 'A' });
    expect(create).toHaveBeenCalledWith({
      data: { email: 'a@b.com', passwordHash: 'h', displayName: 'A' },
    });
  });
});
