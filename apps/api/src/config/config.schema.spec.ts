import { validateConfig } from './config.schema';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'x'.repeat(32),
  APP_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
};

describe('validateConfig', () => {
  it('parses a valid env and applies defaults', () => {
    const cfg = validateConfig({ ...base });
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.PORT).toBe(3000);
    expect(cfg.LLM_DEFAULT_PROVIDER).toBe('openai');
    expect(cfg.RESEARCH_DEFAULT_PROVIDER).toBe('tavily');
    expect(cfg.JWT_EXPIRES_IN).toBe('7d');
  });

  it('coerces PORT from a string to a number', () => {
    expect(validateConfig({ ...base, PORT: '4000' }).PORT).toBe(4000);
  });

  it('accepts postgres and redis URLs', () => {
    expect(() => validateConfig({ ...base })).not.toThrow();
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => validateConfig(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => validateConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('throws when APP_ENCRYPTION_KEY is too short', () => {
    expect(() => validateConfig({ ...base, APP_ENCRYPTION_KEY: 'abc' })).toThrow(
      /APP_ENCRYPTION_KEY/,
    );
  });

  it('throws on an unknown LLM_DEFAULT_PROVIDER', () => {
    expect(() => validateConfig({ ...base, LLM_DEFAULT_PROVIDER: 'lmstudio' })).toThrow();
  });

  it('accepts an optional comma-separated CORS_ORIGINS', () => {
    expect(validateConfig({ ...base, CORS_ORIGINS: 'http://localhost:5173' }).CORS_ORIGINS).toBe(
      'http://localhost:5173',
    );
    expect(validateConfig({ ...base }).CORS_ORIGINS).toBeUndefined();
  });
});
