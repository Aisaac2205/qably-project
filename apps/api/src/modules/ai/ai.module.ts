import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { GEMINI_CLIENT, TEST_CASE_EXTRACTOR } from './ai.tokens';
import { DisabledExtractor } from './disabled.extractor';
import { createGeminiClient, GeminiExtractor } from './gemini.extractor';

@Module({
  imports: [ConfigModule],
  providers: [
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
  exports: [TEST_CASE_EXTRACTOR],
})
export class AiModule {}
