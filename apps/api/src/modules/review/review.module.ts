import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { AiModule } from '../ai/ai.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SourceReader } from '../repository/source-reader';
import { ExtractionProcessor } from './extraction.processor';
import { ExtractionService } from './extraction.service';
import { EXTRACTION_QUEUE } from './review.contracts';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { SuiteProposalsController } from './suite-proposals.controller';

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
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [ReviewController, SuiteProposalsController],
  providers: [
    ReviewService,
    ExtractionService,
    ExtractionProcessor,
    EncryptionService,
    SourceReader,
  ],
  exports: [ExtractionService],
})
export class ReviewModule {}
