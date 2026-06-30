import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
