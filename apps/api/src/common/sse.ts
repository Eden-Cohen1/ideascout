import type { Response } from 'express';

/** Write one Server-Sent-Events `data:` frame (JSON-encoded). */
export function writeSseEvent(res: Response, event: unknown): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Pipe an in-process async generator to an Express response as an SSE stream: set the
 * SSE headers, write one `data:` frame per yielded event, convert a thrown error into a
 * final event via `toErrorEvent`, then end the response. Used by streaming POST endpoints
 * (which can't use Nest's GET-oriented `@Sse()`). Generation is synchronous/in-process.
 */
export async function streamSse<T>(
  res: Response,
  events: AsyncIterable<T>,
  toErrorEvent: (error: unknown) => T,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  try {
    for await (const event of events) {
      writeSseEvent(res, event);
    }
  } catch (error) {
    writeSseEvent(res, toErrorEvent(error));
  }
  res.end();
}
