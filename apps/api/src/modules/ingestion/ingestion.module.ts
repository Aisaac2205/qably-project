import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BitbucketAdapter } from './adapters/bitbucket.adapter';
import { GithubAdapter } from './adapters/github.adapter';
import { IngestionController } from './ingestion.controller';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionService } from './ingestion.service';
import { INGESTION_QUEUE, SCM_ADAPTERS } from './ingestion.tokens';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    NotificationsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({ connection: { url: env.REDIS_URL } }),
    }),
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
  ],
  controllers: [IngestionController],
  providers: [
    EncryptionService,
    IngestionService,
    IngestionProcessor,
    GithubAdapter,
    BitbucketAdapter,
    {
      provide: SCM_ADAPTERS,
      inject: [GithubAdapter, BitbucketAdapter],
      useFactory: (github: GithubAdapter, bitbucket: BitbucketAdapter) => [
        github,
        bitbucket,
      ],
    },
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
