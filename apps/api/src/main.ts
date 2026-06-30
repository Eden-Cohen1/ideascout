import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const config = app.get(AppConfigService);
  await app.listen(config.port);
  new Logger('Bootstrap').log(`ideascout API listening on :${config.port}`);
}

void bootstrap();
