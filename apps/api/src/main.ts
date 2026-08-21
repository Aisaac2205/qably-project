import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ENV } from './config/config.tokens';
import type { Env } from './config/env';

const AUTH_PATH_PREFIX = '/api/auth';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const env = app.get<Env>(ENV);

  const jsonParser = express.json({ limit: '1mb' });
  app.use(
    (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      if (request.path.startsWith(AUTH_PATH_PREFIX)) return next();
      return jsonParser(request, response, next);
    },
  );

  app.use(helmet());
  app.enableCors({ origin: env.BETTER_AUTH_URL, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter(env.NODE_ENV === 'production'));
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`Qably API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
