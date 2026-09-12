import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  createAccessLogMiddleware,
  createStdoutSink,
} from './common/http/access-log.middleware';
import { configureHttpPipeline } from './common/http/configure-http-pipeline';
import { ENV } from './config/config.tokens';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const env = app.get<Env>(ENV);

  app.use(
    createAccessLogMiddleware({
      sink: createStdoutSink(env.NODE_ENV === 'production' ? 'json' : 'pretty'),
    }),
  );

  configureHttpPipeline(app, env);

  // Railway terminates TLS upstream, so without this every request looks
  // like it came from the proxy and per-address throttling collapses.
  const httpServer = app.getHttpAdapter().getInstance() as express.Express;
  httpServer.set('trust proxy', 1);

  app.useGlobalFilters(new AllExceptionsFilter(env.NODE_ENV === 'production'));
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`Qably API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
