import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { QueueEvents } from 'bullmq';
import { ResearchProgressEventSchema, type ResearchProgressEvent } from '@ideascout/shared';
import { RESEARCH_QUEUE_EVENTS } from './jobs.tokens';

const TERMINAL = new Set<ResearchProgressEvent['status']>(['SUCCEEDED', 'FAILED', 'CANCELLED']);

/**
 * Bridges cross-process job progress to per-run SSE streams. The worker emits
 * progress via `job.updateProgress(<ResearchProgressEvent>)`; QueueEvents (this API
 * process) receives them and fans them out to a per-run RxJS Subject that the
 * `@Sse` endpoint subscribes to. Terminal events complete the stream.
 */
@Injectable()
export class ResearchProgressBridge implements OnModuleInit, OnModuleDestroy {
  private readonly subjects = new Map<string, Subject<ResearchProgressEvent>>();

  constructor(@Inject(RESEARCH_QUEUE_EVENTS) private readonly events: QueueEvents) {}

  onModuleInit(): void {
    this.events.on('progress', ({ data }) => {
      const parsed = ResearchProgressEventSchema.safeParse(data);
      if (parsed.success) {
        this.publish(parsed.data);
      }
    });
    // QueueEvents is created with autorun:false so construction never connects
    // (keeps the boot/compile test Redis-free); start consuming now.
    void this.events.run();
  }

  async onModuleDestroy(): Promise<void> {
    for (const subject of this.subjects.values()) {
      subject.complete();
    }
    this.subjects.clear();
    await this.events.close();
  }

  private subjectFor(runId: string): Subject<ResearchProgressEvent> {
    let subject = this.subjects.get(runId);
    if (!subject) {
      subject = new Subject<ResearchProgressEvent>();
      this.subjects.set(runId, subject);
    }
    return subject;
  }

  publish(event: ResearchProgressEvent): void {
    const subject = this.subjectFor(event.runId);
    subject.next(event);
    if (TERMINAL.has(event.status)) {
      subject.complete();
      this.subjects.delete(event.runId);
    }
  }

  stream(runId: string): Observable<ResearchProgressEvent> {
    return this.subjectFor(runId).asObservable();
  }
}
