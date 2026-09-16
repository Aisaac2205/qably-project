import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { AiModule } from '../ai/ai.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SourceReader } from '../repository/source-reader';
import { TestFileLocator } from '../repository/test-file-locator';
import { ExtractionProcessor } from './extraction.processor';
import { ExtractionService } from './extraction.service';
import { EXTRACTION_QUEUE } from './review.contracts';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [
    OrganizationsModule,
    ConfigModule,
    AiModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({ connection: { url: env.REDIS_URL } }),
    }),
    BullModule.registerQueue({
      name: EXTRACTION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        // 2s was too short to survive a per-minute provider rate limit (the
        // most common retryable failure — e.g. the Gemini free tier): the SDK
        // itself already retries transient errors 3x in seconds before
        // giving up, so a job-level retry only helps if it waits meaningfully
        // longer. 30s exponential gives attempts at ~30s and ~60s.
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    ExtractionService,
    ExtractionProcessor,
    EncryptionService,
    SourceReader,
    TestFileLocator,
  ],
  exports: [ExtractionService],
})
export class ReviewModule {}
