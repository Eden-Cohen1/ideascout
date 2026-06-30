import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IdeasService } from './ideas.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('IdeasService', () => {
  describe('create', () => {
    it('creates the idea with an initial version 1 and points currentVersion at it', async () => {
      const ideaCreate = jest.fn().mockResolvedValue({ id: 'i1', projectId: 'p1', title: 'T' });
      const versionCreate = jest.fn().mockResolvedValue({ id: 'v1', version: 1 });
      const ideaUpdate = jest.fn().mockResolvedValue({ id: 'i1', currentVersion: { id: 'v1' } });
      const tx = {
        idea: { create: ideaCreate, update: ideaUpdate },
        ideaVersion: { create: versionCreate },
      };
      const prisma = {
        $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      } as unknown as PrismaService;

      await new IdeasService(prisma).create('p1', {
        title: 'T',
        problem: 'P',
        solution: 'S',
        targetCustomer: 'C',
        attributes: {},
      });

      expect(ideaCreate).toHaveBeenCalledWith({ data: { projectId: 'p1', title: 'T' } });
      expect(versionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ideaId: 'i1', version: 1, problem: 'P', solution: 'S' }),
        }),
      );
      expect(ideaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentVersionId: 'v1' }) }),
      );
    });
  });

  describe('getInProject', () => {
    it('returns the idea when it belongs to the project', async () => {
      const idea = { id: 'i1', projectId: 'p1', currentVersion: null };
      const prisma = {
        idea: { findUnique: jest.fn().mockResolvedValue(idea) },
      } as unknown as PrismaService;
      await expect(new IdeasService(prisma).getInProject('p1', 'i1')).resolves.toBe(idea);
    });

    it('404s when the idea belongs to a different project', async () => {
      const prisma = {
        idea: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', projectId: 'other' }) },
      } as unknown as PrismaService;
      await expect(new IdeasService(prisma).getInProject('p1', 'i1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s when the idea does not exist', async () => {
      const prisma = {
        idea: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      await expect(new IdeasService(prisma).getInProject('p1', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('creates the next version from the current (patched) and repoints currentVersion', async () => {
      const idea = {
        id: 'i1',
        projectId: 'p1',
        title: 'Old',
        state: 'IDEA',
        currentVersion: {
          id: 'v1',
          version: 1,
          problem: 'P1',
          solution: 'S1',
          targetCustomer: 'C1',
          attributes: {},
        },
      };
      const versionCreate = jest.fn().mockResolvedValue({ id: 'v2', version: 2 });
      const ideaUpdate = jest.fn().mockResolvedValue({ id: 'i1', currentVersion: { id: 'v2' } });
      const tx = { ideaVersion: { create: versionCreate }, idea: { update: ideaUpdate } };
      const prisma = {
        idea: { findUnique: jest.fn().mockResolvedValue(idea) },
        $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      } as unknown as PrismaService;

      await new IdeasService(prisma).update('p1', 'i1', { problem: 'P2' });

      expect(versionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 2, problem: 'P2', solution: 'S1' }),
        }),
      );
      expect(ideaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentVersionId: 'v2' }) }),
      );
    });
  });

  describe('transition', () => {
    function prismaForIdea(state: string, update = jest.fn().mockResolvedValue({})): PrismaService {
      return {
        idea: {
          findUnique: jest.fn().mockResolvedValue({ id: 'i1', projectId: 'p1', state }),
          update,
        },
      } as unknown as PrismaService;
    }

    it('updates state on a valid lifecycle move', async () => {
      const update = jest.fn().mockResolvedValue({ id: 'i1', state: 'RESEARCH' });
      await new IdeasService(prismaForIdea('IDEA', update)).transition('p1', 'i1', 'RESEARCH');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'i1' }, data: { state: 'RESEARCH' } }),
      );
    });

    it('rejects an invalid lifecycle move', async () => {
      await expect(
        new IdeasService(prismaForIdea('IDEA')).transition('p1', 'i1', 'VALIDATE'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
