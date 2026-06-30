import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`ideascout API listening on :${port}`);
}

void bootstrap();
