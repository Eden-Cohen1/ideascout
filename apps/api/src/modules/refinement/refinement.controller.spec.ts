import type { Response } from 'express';
import { NotFoundException } from '@nestjs/common';
import type { RefinementService } from './refinement.service';
import { RefinementController } from './refinement.controller';

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

describe('RefinementController', () => {
  it('GET returns the thread', async () => {
    const service = {
      listThread: jest.fn().mockResolvedValue([{ id: 'm1' }]),
    } as unknown as RefinementService;
    const controller = new RefinementController(service);
    expect(await controller.thread('proj1', 'idea1')).toEqual([{ id: 'm1' }]);
    expect(service.listThread).toHaveBeenCalledWith('proj1', 'idea1');
  });

  it('POST writes each event as an SSE frame then ends', async () => {
    async function* gen() {
      yield { type: 'token', delta: 'Hi' };
      yield { type: 'message', message: { id: 'm2' } };
    }
    const service = { generate: jest.fn().mockReturnValue(gen()) } as unknown as RefinementService;
    const controller = new RefinementController(service);
    const { res, writes } = makeRes();

    await controller.stream('proj1', 'idea1', { content: 'hello' }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(writes[0]).toBe(`data: ${JSON.stringify({ type: 'token', delta: 'Hi' })}\n\n`);
    expect(writes[1]).toBe(
      `data: ${JSON.stringify({ type: 'message', message: { id: 'm2' } })}\n\n`,
    );
    expect(res.end).toHaveBeenCalled();
  });

  it('POST apply maps the new idea version to the IdeaResponse contract', async () => {
    const rawIdea = {
      id: 'idea1',
      projectId: 'proj1',
      title: 'Acme',
      state: 'REFINE',
      currentVersionId: 'v2',
      currentVersion: {
        id: 'v2',
        version: 2,
        problem: 'sharper problem',
        solution: 's',
        targetCustomer: null,
        attributes: {},
        createdAt: new Date('2026-07-01T00:00:00Z'),
        ideaId: 'idea1',
      },
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    };
    const service = {
      applyPatch: jest.fn().mockResolvedValue(rawIdea),
    } as unknown as RefinementService;
    const controller = new RefinementController(service);

    const result = await controller.apply('proj1', 'idea1', 'm2');

    expect(service.applyPatch).toHaveBeenCalledWith('proj1', 'idea1', 'm2');
    // Mapped to the shared IdeaResponse shape: ISO dates, no raw Prisma internals.
    expect(result.currentVersion).toMatchObject({ version: 2, problem: 'sharper problem' });
    expect(result.currentVersion?.createdAt).toBe('2026-07-01T00:00:00.000Z');
    expect(result).not.toHaveProperty('currentVersionId');
  });

  it('POST writes an error SSE frame and ends when generate throws before yielding', async () => {
    async function* gen() {
      throw new NotFoundException('Idea not found');
      yield { type: 'token', delta: '' };
    }
    const service = { generate: jest.fn().mockReturnValue(gen()) } as unknown as RefinementService;
    const controller = new RefinementController(service);
    const { res, writes } = makeRes();

    await controller.stream('proj1', 'idea1', { content: 'hello' }, res);

    expect(writes[0]).toBe(
      `data: ${JSON.stringify({ type: 'error', message: 'Idea not found' })}\n\n`,
    );
    expect(res.end).toHaveBeenCalled();
  });
});
