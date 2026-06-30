import { z } from 'zod';
import { LLM_PROVIDER_IDS, RESEARCH_PROVIDER_IDS } from '../enums';

/** Which AI/research adapters this project prefers (absent => global default). */
export const ProviderSelectionSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDER_IDS).optional(),
  llmModel: z.string().optional(),
  researchProvider: z.enum(RESEARCH_PROVIDER_IDS).optional(),
});

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateProjectRequestSchema =
  CreateProjectRequestSchema.partial().merge(ProviderSelectionSchema);

export const ProjectResponseSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  llmProvider: z.string().nullable().optional(),
  llmModel: z.string().nullable().optional(),
  researchProvider: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProviderSelection = z.infer<typeof ProviderSelectionSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
