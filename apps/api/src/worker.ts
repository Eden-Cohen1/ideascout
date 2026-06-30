import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type Job, Worker } from 'bullmq';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { RESEARCH_QUEUE_NAME, type ResearchJobData } from './modules/jobs/jobs.tokens';
import { redisConnection } from './modules/jobs/redis.connection';
import { ResearchProcessor } from './modules/research/research.processor';

/**
 * BullMQ worker entrypoint. Boots the SAME Nest DI container as the HTTP app
 * (createApplicationContext — no HTTP server), so the processor reuses the exact
 * same Prisma, config, and provider registry. Run with: node dist/worker.js.
 */
async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const config = app.get(AppConfigService);
  const processor = app.get(ResearchProcessor);
  const log = new Logger('Worker');

  const worker = new Worker<ResearchJobData>(
    RESEARCH_QUEUE_NAME,
    (job: Job<ResearchJobData>) => processor.process(job),
    { connection: redisConnection(config.redisUrl), concurrency: 2 },
  );

  worker.on('ready', () => log.log('research worker ready'));
  worker.on('completed', (job) => log.log(`run ${job.data.runId} completed`));
  worker.on('failed', (job, err) => log.error(`run ${job?.data.runId} failed: ${err.message}`));

  const shutdown = async (): Promise<void> => {
    log.log('shutting down worker...');
    await worker.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  log.log('ideascout research worker started');
}

void bootstrapWorker();
