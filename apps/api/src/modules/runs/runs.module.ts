import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RunIngestProcessor } from './run-ingest.processor';
import { RunQueriesController } from './run-queries.controller';
import { RunQueriesService } from './run-queries.service';
import { RunsController } from './runs.controller';
import { RUN_INGEST_QUEUE } from './runs.contracts';
import { RunsService } from './runs.service';

@Module({
  imports: [
    ApiKeysModule,
    OrganizationsModule,
    NotificationsModule,
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({ connection: { url: env.REDIS_URL } }),
    }),
    BullModule.registerQueue({
      name: RUN_INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [RunsController, RunQueriesController],
  providers: [RunsService, RunQueriesService, RunIngestProcessor],
  exports: [RunQueriesService],
})
export class RunsModule {}
