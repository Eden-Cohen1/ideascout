import { z } from 'zod';
import type { LlmMessage } from '../providers/llm/llm-provider.interface';

/** System persona for the refinement chat. */
export const REFINEMENT_SYSTEM_PROMPT =
  'You are a startup advisor helping the founder refine their idea. Be specific, ' +
  'candid, and constructive. Use the research findings provided as context. When you ' +
  'recommend concrete changes to the idea, state them plainly in your reply — a ' +
  'separate step will turn them into a structured patch.';

/**
 * Internal-only contract for the second (structured) LLM call that extracts a proposed
 * idea edit from the advisor's reply. Every field is optional: an empty object means
 * "no change proposed". Kept here (not in @ideascout/shared) because it never crosses a
 * boundary — the API turns it into the shared `ProposedPatch` before persisting.
 */
export const PatchExtractionSchema = z.object({
  problem: z.string().optional(),
  solution: z.string().optional(),
  targetCustomer: z.string().optional(),
  reasoning: z.string().optional(),
});

export type PatchExtraction = z.infer<typeof PatchExtractionSchema>;

/** Messages for the patch-extraction call: given the idea + the advisor reply, emit edits. */
export function patchExtractionMessages(ideaBrief: string, reply: string): LlmMessage[] {
  return [
    {
      role: 'system',
      content:
        'Extract any concrete edits to the idea implied by the advisor reply. Return a ' +
        'JSON object with optional fields problem, solution, targetCustomer, and reasoning. ' +
        'Only include a field if the reply clearly recommends changing it; otherwise omit ' +
        'it. If nothing should change, return {}.',
    },
    {
      role: 'user',
      content: `=== CURRENT IDEA ===\n${ideaBrief}\n\n=== ADVISOR REPLY ===\n${reply}`,
    },
  ];
}
