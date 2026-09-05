import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  createAccessLogMiddleware,
  createStdoutSink,
} from './common/http/access-log.middleware';
import { jsonWithRawBody } from './common/http/raw-body';
import { ENV } from './config/config.tokens';
import { buildCorsOptions } from './config/cors';
import type { Env } from './config/env';

const AUTH_PATH_PREFIX = '/api/auth';

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

  const xmlParser = express.text({
    type: ['application/xml', 'text/xml'],
    limit: '10mb',
  });
  app.use(xmlParser);

  const jsonParser = jsonWithRawBody();
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

  // Railway terminates TLS upstream, so without this every request looks
  // like it came from the proxy and per-address throttling collapses.
  const httpServer = app.getHttpAdapter().getInstance() as express.Express;
  httpServer.set('trust proxy', 1);

  app.use(helmet());
  app.enableCors(buildCorsOptions(env));
  app.useGlobalFilters(new AllExceptionsFilter(env.NODE_ENV === 'production'));
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`Qably API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
