import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  FLUSH_BATCH_SCRIPT,
  RECORD_SUITE_RESULT_SCRIPT,
} from './lib/report-batch.lua';
import { ReportBatchService } from './report-batch.service';
import { REPORT_BATCH_REDIS } from './report-batch.tokens';
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
  providers: [
    RunsService,
    RunQueriesService,
    RunIngestProcessor,
    ReportBatchService,
    {
      provide: REPORT_BATCH_REDIS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const client = new Redis(env.REDIS_URL);
        client.defineCommand('recordReportSuiteResult', {
          numberOfKeys: 2,
          lua: RECORD_SUITE_RESULT_SCRIPT,
        });
        client.defineCommand('flushReportBatch', {
          numberOfKeys: 2,
          lua: FLUSH_BATCH_SCRIPT,
        });
        return client;
      },
    },
  ],
  exports: [RunQueriesService],
})
export class RunsModule {}
