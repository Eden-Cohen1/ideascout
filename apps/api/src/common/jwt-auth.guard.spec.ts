import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeGuard(verifyImpl: (token: string) => Promise<unknown>): JwtAuthGuard {
  const jwt = { verifyAsync: jest.fn(verifyImpl) } as unknown as JwtService;
  return new JwtAuthGuard(jwt);
}

function contextWith(headers: Record<string, string | undefined>): {
  ctx: ExecutionContext;
  req: { headers: typeof headers; user?: unknown };
} {
  const req: { headers: typeof headers; user?: unknown } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('JwtAuthGuard', () => {
  it('allows a valid token and attaches the user to the request', async () => {
    const guard = makeGuard(async () => ({ sub: 'u1', email: 'a@b.com' }));
    const { ctx, req } = contextWith({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('rejects a request with no Authorization header', async () => {
    const guard = makeGuard(async () => ({}));
    const { ctx } = contextWith({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-Bearer scheme', async () => {
    const guard = makeGuard(async () => ({ sub: 'u1', email: 'a@b.com' }));
    const { ctx } = contextWith({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    const guard = makeGuard(async () => {
      throw new Error('bad token');
    });
    const { ctx } = contextWith({ authorization: 'Bearer bad' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
