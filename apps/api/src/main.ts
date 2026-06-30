import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { API_PREFIX } from '@ideascout/shared';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const config = app.get(AppConfigService);

  // CORS for the web frontend (cross-origin). Empty list => same-origin only.
  const corsOrigins = config.corsOrigins;
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins.includes('*') ? true : corsOrigins,
      credentials: true,
    });
  }

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));

  // Interactive OpenAPI docs at /api/docs (JSON at /api/docs-json).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ideascout API')
    .setDescription('Automated startup-idea evaluation & validation platform.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.port);
  const log = new Logger('Bootstrap');
  log.log(`ideascout API listening on :${config.port}`);
  log.log(`API docs at http://localhost:${config.port}/api/docs`);
}

void bootstrap();
