import type { INestApplication } from '@nestjs/common';
import express from 'express';
import helmet from 'helmet';
import { buildCorsOptions } from '../../config/cors';
import type { Env } from '../../config/env';
import { jsonWithRawBody } from './raw-body';

const AUTH_PATH_PREFIX = '/api/auth';
const JUNIT_INGEST_PATH = '/runs/ingest/junit';
const XML_BODY_LIMIT = '10mb';

export function configureHttpPipeline(
  app: INestApplication,
  env: Pick<Env, 'WEB_APP_URL'>,
): void {
  app.use(helmet());
  app.enableCors(buildCorsOptions(env));

  const xmlParser = express.text({
    type: ['application/xml', 'text/xml'],
    limit: XML_BODY_LIMIT,
  });
  app.use(
    JUNIT_INGEST_PATH,
    (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      if (request.method !== 'POST') return next();
      return xmlParser(request, response, next);
    },
  );

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
}
