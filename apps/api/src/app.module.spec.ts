import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { CryptoService } from './crypto/crypto.service';
import { PrismaService } from './prisma/prisma.service';
import { LlmRegistry } from './modules/providers/llm/llm.registry';
import { RESEARCH_QUEUE, RESEARCH_QUEUE_EVENTS } from './modules/jobs/jobs.tokens';

describe('AppModule (integration)', () => {
  beforeAll(() => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'x'.repeat(32),
      APP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    });
  });

  it('boots, validates config, and wires ConfigModule + CryptoModule', async () => {
    // Fake the BullMQ providers so this boot test doesn't open real Redis clients
    // (the queue is exercised for real in the live verification).
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RESEARCH_QUEUE)
      .useValue({ add: jest.fn(), close: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(RESEARCH_QUEUE_EVENTS)
      .useValue({ on: jest.fn(), run: jest.fn(), close: jest.fn().mockResolvedValue(undefined) })
      .compile();

    const config = moduleRef.get(AppConfigService);
    const crypto = moduleRef.get(CryptoService);
    const prisma = moduleRef.get(PrismaService);
    const llm = moduleRef.get(LlmRegistry);

    expect(config.port).toBeGreaterThan(0);
    const enc = crypto.encrypt('hello');
    expect(crypto.decrypt(enc)).toBe('hello');
    expect(prisma).toBeDefined();
    // No provider keys in the test env -> registry resolves to the mock adapter.
    expect(llm.resolve().id).toBe('mock');

    await moduleRef.close();
  });
});
