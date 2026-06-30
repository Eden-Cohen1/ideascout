import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

interface DepOpts {
  findByEmail?: () => Promise<unknown>;
  create?: () => Promise<unknown>;
  verify?: () => Promise<boolean>;
}

function makeService(opts: DepOpts) {
  const users = {
    findByEmail: jest.fn(opts.findByEmail ?? (async () => null)),
    create: jest.fn(
      opts.create ?? (async () => ({ id: 'u1', email: 'a@b.com', displayName: null })),
    ),
    findById: jest.fn(),
  };
  const passwords = {
    hash: jest.fn(async () => 'hashed'),
    verify: jest.fn(opts.verify ?? (async () => true)),
  };
  const jwt = { signAsync: jest.fn(async () => 'token') };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AuthService(users as any, passwords as any, jwt as any);
  return { service, users, passwords, jwt };
}

describe('AuthService', () => {
  it('register hashes the password, creates the user, and returns a token', async () => {
    const { service, users, passwords } = makeService({
      findByEmail: async () => null,
      create: async () => ({ id: 'u1', email: 'a@b.com', displayName: null }),
    });
    const res = await service.register({ email: 'a@b.com', password: 'longenough' });
    expect(passwords.hash).toHaveBeenCalledWith('longenough');
    expect(users.create).toHaveBeenCalled();
    expect(res).toEqual({
      accessToken: 'token',
      user: { id: 'u1', email: 'a@b.com', displayName: null },
    });
  });

  it('register rejects a duplicate email', async () => {
    const { service } = makeService({ findByEmail: async () => ({ id: 'x' }) });
    await expect(
      service.register({ email: 'a@b.com', password: 'longenough' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login returns a token for valid credentials', async () => {
    const { service } = makeService({
      findByEmail: async () => ({
        id: 'u1',
        email: 'a@b.com',
        displayName: null,
        passwordHash: 'h',
      }),
      verify: async () => true,
    });
    const res = await service.login({ email: 'a@b.com', password: 'longenough' });
    expect(res.accessToken).toBe('token');
  });

  it('login rejects a wrong password', async () => {
    const { service } = makeService({
      findByEmail: async () => ({ id: 'u1', email: 'a@b.com', passwordHash: 'h' }),
      verify: async () => false,
    });
    await expect(service.login({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login rejects an unknown email', async () => {
    const { service } = makeService({ findByEmail: async () => null });
    await expect(service.login({ email: 'a@b.com', password: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
