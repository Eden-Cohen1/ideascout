import type { QueueEvents } from 'bullmq';
import type { ResearchProgressEvent } from '@ideascout/shared';
import { ResearchProgressBridge } from './research-progress.bridge';

function makeBridge(): ResearchProgressBridge {
  // QueueEvents is only touched in onModuleInit (not under test here).
  const events = { on: jest.fn(), close: jest.fn() } as unknown as QueueEvents;
  return new ResearchProgressBridge(events);
}

function evt(
  runId: string,
  status: ResearchProgressEvent['status'],
  progress: number,
): ResearchProgressEvent {
  return { runId, status, step: null, progress, at: '2026-01-01T00:00:00.000Z' };
}

describe('ResearchProgressBridge', () => {
  it('delivers a published event to a stream subscriber', () => {
    const bridge = makeBridge();
    const received: ResearchProgressEvent[] = [];
    bridge.stream('r1').subscribe((e) => received.push(e));
    bridge.publish(evt('r1', 'RUNNING', 30));
    expect(received).toHaveLength(1);
    expect(received[0].progress).toBe(30);
  });

  it('completes the stream on a terminal status', () => {
    const bridge = makeBridge();
    let completed = false;
    bridge.stream('r1').subscribe({ complete: () => (completed = true) });
    bridge.publish(evt('r1', 'SUCCEEDED', 100));
    expect(completed).toBe(true);
  });

  it('isolates streams by runId', () => {
    const bridge = makeBridge();
    const a: ResearchProgressEvent[] = [];
    const b: ResearchProgressEvent[] = [];
    bridge.stream('a').subscribe((e) => a.push(e));
    bridge.stream('b').subscribe((e) => b.push(e));
    bridge.publish(evt('b', 'RUNNING', 10));
    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });
});
