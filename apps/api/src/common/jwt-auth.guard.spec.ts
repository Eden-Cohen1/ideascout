import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeGuard(verifyImpl: (token: string) => Promise<unknown>): JwtAuthGuard {
  const jwt = { verifyAsync: jest.fn(verifyImpl) } as unknown as JwtService;
  return new JwtAuthGuard(jwt);
}

function contextWith(
  headers: Record<string, string | undefined>,
  cookies?: Record<string, string | undefined>,
): {
  ctx: ExecutionContext;
  req: { headers: typeof headers; cookies?: typeof cookies; user?: unknown };
} {
  const req: { headers: typeof headers; cookies?: typeof cookies; user?: unknown } = {
    headers,
    cookies,
  };
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

  it('accepts a token from the access_token cookie when no header is present', async () => {
    const guard = makeGuard(async () => ({ sub: 'u1', email: 'a@b.com' }));
    const { ctx, req } = contextWith({}, { access_token: 'good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('prefers the cookie over the Authorization header when both are present', async () => {
    const verify = jest.fn(async () => ({ sub: 'u1', email: 'a@b.com' }));
    const guard = makeGuard(verify);
    const { ctx } = contextWith(
      { authorization: 'Bearer header-token' },
      { access_token: 'cookie-token' },
    );
    await guard.canActivate(ctx);
    expect(verify).toHaveBeenCalledWith('cookie-token');
  });
});
