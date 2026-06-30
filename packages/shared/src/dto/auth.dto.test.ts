import { describe, expect, it } from 'vitest';
import { RegisterRequestSchema, LoginRequestSchema, AuthResponseSchema } from './auth.dto';

describe('RegisterRequestSchema', () => {
  const valid = { email: 'founder@example.com', password: 'longenough', displayName: 'Eden' };

  it('parses a valid registration', () => {
    expect(RegisterRequestSchema.parse(valid)).toMatchObject({ email: 'founder@example.com' });
  });

  it('treats displayName as optional', () => {
    const { displayName: _d, ...rest } = valid;
    expect(() => RegisterRequestSchema.parse(rest)).not.toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() => RegisterRequestSchema.parse({ ...valid, email: 'nope' })).toThrow();
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() => RegisterRequestSchema.parse({ ...valid, password: 'short' })).toThrow();
  });
});

describe('LoginRequestSchema', () => {
  it('requires email and password', () => {
    expect(() => LoginRequestSchema.parse({ email: 'a@b.com' })).toThrow();
  });
});

describe('AuthResponseSchema', () => {
  it('parses an auth response', () => {
    const parsed = AuthResponseSchema.parse({
      accessToken: 'jwt',
      user: { id: 'u1', email: 'a@b.com', displayName: null },
    });
    expect(parsed.accessToken).toBe('jwt');
  });
});
