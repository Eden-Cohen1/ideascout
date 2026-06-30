// @ideascout/shared — single source of truth for cross-cutting contracts.

// Enums + route constants
export * from './enums';
export * from './api-routes';

// AI structured-output contracts (domain)
export * from './domain/citation.schema';
export * from './domain/verdict.schema';
export * from './domain/competitor.schema';
export * from './domain/moat.schema';

// Request/response DTOs
export * from './dto/auth.dto';
export * from './dto/project.dto';
export * from './dto/idea.dto';
export * from './dto/research.dto';
export * from './dto/refinement.dto';

// Realtime events
export * from './events/research-progress.event';
