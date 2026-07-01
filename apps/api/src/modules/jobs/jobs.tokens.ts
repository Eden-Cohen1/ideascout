/** BullMQ queue name + DI tokens for the research jobs infrastructure. */
export const RESEARCH_QUEUE_NAME = 'research';
export const RESEARCH_QUEUE = Symbol('RESEARCH_QUEUE');
export const RESEARCH_QUEUE_EVENTS = Symbol('RESEARCH_QUEUE_EVENTS');

/** Job payload enqueued for a research run. */
export interface ResearchJobData {
  runId: string;
}
