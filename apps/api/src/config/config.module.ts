import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import { validateConfig } from './config.schema';

/**
 * Loads .env (via @nestjs/config), validates the environment once with Zod,
 * and exposes a typed AppConfigService app-wide. Boot fails fast on bad config.
 */
@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, cache: true })],
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(validateConfig(process.env)),
    },
  ],
  exports: [AppConfigService],
})
export class ConfigModule {}
