import ms from 'ms';
import type { CookieOptions } from 'express';
import type { AppConfigService } from '../../config/config.service';

export const ACCESS_TOKEN_COOKIE = 'access_token';

// sameSite 'lax' (not 'strict') so the cookie survives a cross-site top-level
// navigation; still CSRF-safe here since web+API are same-origin (Vite proxy / nginx).
export function cookieOptions(config: AppConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ms(config.jwt.expiresIn as ms.StringValue),
  };
}
