import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResearchPipeline } from './research-pipeline';
import { RESEARCH_STORE } from './research-store';
import { PrismaResearchStore } from './prisma-research-store';
import { PIPELINE_STEPS, stepProviders } from './steps';

/**
 * Assembles the research pipeline: the ordered steps, the orchestrator, and the
 * persistence seam. `RESEARCH_STORE` binds to the Prisma store here — point it at a
 * different implementation to swap the database with zero changes to the pipeline.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    ...stepProviders,
    { provide: RESEARCH_STORE, useClass: PrismaResearchStore },
    ResearchPipeline,
  ],
  exports: [ResearchPipeline, PIPELINE_STEPS],
})
export class PipelineModule {}
