import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// Feature modules (Auth, Projects, Ideas, Research, Refinement, Providers, Jobs)
// are added here as Phase 1 milestones land.
@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
