import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { AppConfigService } from '../../config/config.service';
import { RESEARCH_QUEUE, RESEARCH_QUEUE_EVENTS, RESEARCH_QUEUE_NAME } from './jobs.tokens';
import { redisConnection } from './redis.connection';
import { ResearchProgressBridge } from './research-progress.bridge';

/** Closes the queue + queue-events (and their connections) on shutdown. */
@Injectable()
class JobsLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(RESEARCH_QUEUE) private readonly queue: Queue,
    @Inject(RESEARCH_QUEUE_EVENTS) private readonly events: QueueEvents,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.queue.close(), this.events.close()]);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: RESEARCH_QUEUE,
      useFactory: (config: AppConfigService) =>
        new Queue(RESEARCH_QUEUE_NAME, { connection: redisConnection(config.redisUrl) }),
      inject: [AppConfigService],
    },
    {
      provide: RESEARCH_QUEUE_EVENTS,
      useFactory: (config: AppConfigService) =>
        new QueueEvents(RESEARCH_QUEUE_NAME, {
          connection: redisConnection(config.redisUrl),
          autorun: false,
        }),
      inject: [AppConfigService],
    },
    ResearchProgressBridge,
    JobsLifecycle,
  ],
  exports: [RESEARCH_QUEUE, RESEARCH_QUEUE_EVENTS, ResearchProgressBridge],
})
export class JobsModule {}
