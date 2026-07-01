import { z } from 'zod';
import { RefinementMessageResponseSchema } from '../dto/refinement.dto';

/**
 * Frames streamed over the refinement SSE endpoint (`POST .../refine`). The advisor's
 * reply arrives as a run of `token` frames, then exactly one terminal frame: a
 * `message` (the persisted assistant message + any proposed patch) on success, or an
 * `error` on failure.
 */
export const RefinementStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), delta: z.string() }),
  z.object({ type: z.literal('message'), message: RefinementMessageResponseSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type RefinementStreamEvent = z.infer<typeof RefinementStreamEventSchema>;
