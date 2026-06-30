import 'reflect-metadata';
import { Logger } from '@nestjs/common';

/**
 * BullMQ worker entrypoint (implemented in the Jobs milestone — see plan §7).
 *
 * Will boot the same Nest DI container as the HTTP app via
 * `NestFactory.createApplicationContext(AppModule)` and start a
 * `Worker('research', ...)` that drives the research pipeline — reusing the exact
 * same adapter registry, Prisma, and config as the API process.
 */
async function bootstrapWorker(): Promise<void> {
  new Logger('Worker').log('ideascout worker placeholder — implemented in the Jobs milestone');
}

void bootstrapWorker();
