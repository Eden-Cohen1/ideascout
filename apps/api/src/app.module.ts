import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthModule } from './health/health.module';

// Feature modules (Auth, Projects, Ideas, Research, Refinement, Providers, Jobs)
// are added here as Phase 1 milestones land.
@Module({
  imports: [ConfigModule, CryptoModule, HealthModule],
})
export class AppModule {}
