import { AppConfigService } from './config.service';
import type { AppConfig } from './config.schema';

const sample: AppConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'x'.repeat(32),
  JWT_EXPIRES_IN: '7d',
  APP_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  LLM_DEFAULT_PROVIDER: 'openai',
  LLM_DEFAULT_MODEL: undefined,
  RESEARCH_DEFAULT_PROVIDER: 'tavily',
  OPENAI_API_KEY: 'sk-openai',
  ANTHROPIC_API_KEY: undefined,
  GEMINI_API_KEY: undefined,
  TAVILY_API_KEY: undefined,
};

describe('AppConfigService', () => {
  const svc = new AppConfigService(sample);

  it('exposes typed config sections', () => {
    expect(svc.port).toBe(3000);
    expect(svc.jwt).toEqual({ secret: 'x'.repeat(32), expiresIn: '7d' });
    expect(svc.llm.defaultProvider).toBe('openai');
    expect(svc.research.defaultProvider).toBe('tavily');
  });

  it('reports production status from NODE_ENV', () => {
    expect(svc.isProduction).toBe(false);
    expect(new AppConfigService({ ...sample, NODE_ENV: 'production' }).isProduction).toBe(true);
  });

  it('returns provider keys, or undefined when unset/unknown', () => {
    expect(svc.providerKey('openai')).toBe('sk-openai');
    expect(svc.providerKey('anthropic')).toBeUndefined();
    expect(svc.providerKey('does-not-exist')).toBeUndefined();
  });
});
