import { z } from 'zod';
import { REFINEMENT_ROLES } from '../enums';

/** A structured edit the assistant proposes to the idea's content. */
export const ProposedPatchSchema = z.object({
  problem: z.string().optional(),
  solution: z.string().optional(),
  targetCustomer: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
});

export const PostRefinementMessageRequestSchema = z.object({
  content: z.string().min(1),
});

export const ApplyRefinementRequestSchema = z.object({
  messageId: z.string().min(1),
});

export const RefinementMessageResponseSchema = z.object({
  id: z.string(),
  role: z.enum(REFINEMENT_ROLES),
  content: z.string(),
  proposedPatch: ProposedPatchSchema.nullable().optional(),
  appliedVersionId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type ProposedPatch = z.infer<typeof ProposedPatchSchema>;
export type PostRefinementMessageRequest = z.infer<typeof PostRefinementMessageRequestSchema>;
export type ApplyRefinementRequest = z.infer<typeof ApplyRefinementRequestSchema>;
export type RefinementMessageResponse = z.infer<typeof RefinementMessageResponseSchema>;
