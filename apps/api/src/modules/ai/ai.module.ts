import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { AiDailyBudget } from './ai-daily-budget.service';
import { AiEntitlementService } from './ai-entitlement.service';
import {
  AI_DAILY_BUDGET_REDIS,
  GEMINI_CLIENT,
  TEST_CASE_EXTRACTOR,
} from './ai.tokens';
import { DisabledExtractor } from './disabled.extractor';
import { AiEntitlementGuard } from './guards/ai-entitlement.guard';
import { createGeminiClient, GeminiExtractor } from './gemini.extractor';

@Module({
  imports: [ConfigModule],
  providers: [
    AiEntitlementService,
    AiEntitlementGuard,
    AiDailyBudget,
    {
      provide: AI_DAILY_BUDGET_REDIS,
      inject: [ENV],
      useFactory: (env: Env) => new Redis(env.REDIS_URL),
    },
    {
      provide: GEMINI_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.GEMINI_API_KEY === undefined
          ? null
          : createGeminiClient(env.GEMINI_API_KEY),
    },
    {
      provide: TEST_CASE_EXTRACTOR,
      inject: [ENV, GEMINI_CLIENT],
      useFactory: (
        env: Env,
        client: ReturnType<typeof createGeminiClient> | null,
      ) =>
        env.GEMINI_API_KEY === undefined || client === null
          ? new DisabledExtractor()
          : new GeminiExtractor(client, env),
    },
  ],
  exports: [
    TEST_CASE_EXTRACTOR,
    GEMINI_CLIENT,
    AiEntitlementService,
    AiEntitlementGuard,
    AiDailyBudget,
  ],
})
export class AiModule {}
