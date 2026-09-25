import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { PROPOSAL_CLASSIFICATION_QUEUE } from './proposal-classification.contracts';
import { ProposalReclassifier } from './proposal-reclassifier';
import { ReclassifySuiteProcessor } from './reclassify-suite.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({ connection: { url: env.REDIS_URL } }),
    }),
    BullModule.registerQueue({
      name: PROPOSAL_CLASSIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 500,
      },
    }),
  ],
  providers: [ProposalReclassifier, ReclassifySuiteProcessor],
  exports: [ProposalReclassifier],
})
export class ProposalClassificationModule {}
