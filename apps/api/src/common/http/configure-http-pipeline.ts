import type { INestApplication } from '@nestjs/common';
import express from 'express';
import helmet from 'helmet';
import { buildCorsOptions } from '../../config/cors';
import type { Env } from '../../config/env';
import { jsonWithRawBody } from './raw-body';

const AUTH_PATH_PREFIX = '/api/auth';

export function configureHttpPipeline(
  app: INestApplication,
  env: Pick<Env, 'WEB_APP_URL'>,
): void {
  app.use(helmet());
  app.enableCors(buildCorsOptions(env));

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
}
