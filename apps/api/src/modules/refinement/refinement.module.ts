import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { IdeasModule } from '../ideas/ideas.module';
import { RefinementController } from './refinement.controller';
import { RefinementService } from './refinement.service';

@Module({
  imports: [ProjectsModule, IdeasModule], // ProjectAccessGuard deps + IdeasService for versioning
  controllers: [RefinementController],
  providers: [RefinementService],
})
export class RefinementModule {}
