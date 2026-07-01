import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { PipelineModule } from '../../pipeline/pipeline.module';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
import { ResearchProcessor } from './research.processor';

@Module({
  imports: [ProjectsModule, PipelineModule], // ProjectAccessGuard + research pipeline
  controllers: [ResearchController],
  providers: [ResearchService, ResearchProcessor],
  exports: [ResearchService, ResearchProcessor],
})
export class ResearchModule {}
