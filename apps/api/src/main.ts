import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ENV } from './config/config.tokens';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);

  app.use(helmet());
  app.enableCors({ origin: env.BETTER_AUTH_URL, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter(env.NODE_ENV === 'production'));
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(`Qably API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
