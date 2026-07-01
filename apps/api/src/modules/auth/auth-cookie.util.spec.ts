import ms from 'ms';
import type { AppConfigService } from '../../config/config.service';
import { cookieOptions } from './auth-cookie.util';

function configWith(isProduction: boolean, expiresIn = '7d'): AppConfigService {
  return { isProduction, jwt: { secret: 'x', expiresIn } } as unknown as AppConfigService;
}

describe('cookieOptions', () => {
  it('is secure in production', () => {
    expect(cookieOptions(configWith(true)).secure).toBe(true);
  });

  it('is not secure outside production (so it still works over plain HTTP in dev)', () => {
    expect(cookieOptions(configWith(false)).secure).toBe(false);
  });

  it('derives maxAge from JWT_EXPIRES_IN', () => {
    expect(cookieOptions(configWith(false, '7d')).maxAge).toBe(ms('7d'));
    expect(cookieOptions(configWith(false, '1h')).maxAge).toBe(ms('1h'));
  });

  it('is httpOnly with a same-origin-safe sameSite policy', () => {
    const options = cookieOptions(configWith(false));
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
  });
});
