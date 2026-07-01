import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';
import { ResearchProcessor } from './research.processor';

@Module({
  imports: [ProjectsModule], // ProjectAccessGuard for the nested routes
  controllers: [ResearchController],
  providers: [ResearchService, ResearchProcessor],
  exports: [ResearchService, ResearchProcessor],
})
export class ResearchModule {}
