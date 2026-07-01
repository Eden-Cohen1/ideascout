import type { Response } from 'express';
import { streamSse, writeSseEvent } from './sse';

function makeRes() {
  const writes: string[] = [];
  const res = {
    setHeader: jest.fn(),
    write: jest.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    end: jest.fn(),
    flushHeaders: jest.fn(),
  } as unknown as Response;
  return { res, writes };
}

describe('sse', () => {
  it('writeSseEvent writes a JSON `data:` frame', () => {
    const { res, writes } = makeRes();
    writeSseEvent(res, { a: 1 });
    expect(writes[0]).toBe('data: {"a":1}\n\n');
  });

  type Ev = { n: number } | { type: 'error'; message: string };

  it('streamSse sets SSE headers, writes each event, and ends once', async () => {
    const { res, writes } = makeRes();
    async function* gen(): AsyncGenerator<Ev> {
      yield { n: 1 };
      yield { n: 2 };
    }
    await streamSse<Ev>(res, gen(), () => ({ type: 'error', message: 'x' }));

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(writes).toEqual(['data: {"n":1}\n\n', 'data: {"n":2}\n\n']);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('streamSse writes a toErrorEvent frame when the generator throws, then ends', async () => {
    const { res, writes } = makeRes();
    async function* gen(): AsyncGenerator<Ev> {
      yield { n: 1 };
      throw new Error('boom');
    }
    await streamSse<Ev>(res, gen(), (e) => ({ type: 'error', message: (e as Error).message }));

    expect(writes[0]).toBe('data: {"n":1}\n\n');
    expect(writes[1]).toBe('data: {"type":"error","message":"boom"}\n\n');
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
