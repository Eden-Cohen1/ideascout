import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { ProvidersModule } from './modules/providers/providers.module';

// Remaining feature modules (Research, Refinement, Jobs) are added here as later
// Phase 1 milestones land.
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CryptoModule,
    HealthModule,
    ProvidersModule,
    AuthModule,
    ProjectsModule,
    IdeasModule,
  ],
})
export class AppModule {}
