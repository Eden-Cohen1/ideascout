import { z } from 'zod';
import { IDEA_LIFECYCLE_STATES } from '../enums';

/** The mutable content of an idea (snapshotted into an IdeaVersion). */
export const IdeaContentSchema = z.object({
  problem: z.string().min(1),
  solution: z.string().min(1),
  targetCustomer: z.string().optional(),
  attributes: z.record(z.unknown()).default({}),
});

export const CreateIdeaRequestSchema = IdeaContentSchema.extend({
  title: z.string().min(1),
});

export const UpdateIdeaRequestSchema = CreateIdeaRequestSchema.partial();

export const IdeaTransitionRequestSchema = z.object({
  state: z.enum(IDEA_LIFECYCLE_STATES),
});

export const IdeaVersionResponseSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  problem: z.string(),
  solution: z.string(),
  targetCustomer: z.string().nullable().optional(),
  attributes: z.record(z.unknown()),
  createdAt: z.string(),
});

export const IdeaResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  state: z.enum(IDEA_LIFECYCLE_STATES),
  currentVersion: IdeaVersionResponseSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IdeaContent = z.infer<typeof IdeaContentSchema>;
export type CreateIdeaRequest = z.infer<typeof CreateIdeaRequestSchema>;
export type UpdateIdeaRequest = z.infer<typeof UpdateIdeaRequestSchema>;
export type IdeaTransitionRequest = z.infer<typeof IdeaTransitionRequestSchema>;
export type IdeaVersionResponse = z.infer<typeof IdeaVersionResponseSchema>;
export type IdeaResponse = z.infer<typeof IdeaResponseSchema>;
