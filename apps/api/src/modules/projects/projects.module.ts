import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectAccessGuard } from './project-access.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
  exports: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
