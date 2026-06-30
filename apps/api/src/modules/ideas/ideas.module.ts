import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { IdeasService } from './ideas.service';
import { IdeasController } from './ideas.controller';

@Module({
  imports: [ProjectsModule], // provides ProjectAccessGuard for the nested routes
  controllers: [IdeasController],
  providers: [IdeasService],
  exports: [IdeasService],
})
export class IdeasModule {}
