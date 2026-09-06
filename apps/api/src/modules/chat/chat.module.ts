import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { GEMINI_CLIENT } from '../ai/ai.tokens';
import type { GeminiClient } from '../ai/gemini.extractor';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DisabledChatAssistant, GeminiChatAssistant } from './chat.assistant';
import { CHAT_ASSISTANT } from './chat.contracts';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [PrismaModule, ConfigModule, AiModule, OrganizationsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: CHAT_ASSISTANT,
      inject: [ENV, GEMINI_CLIENT],
      useFactory: (env: Env, client: GeminiClient | null) =>
        env.GEMINI_API_KEY === undefined || client === null
          ? new DisabledChatAssistant()
          : new GeminiChatAssistant(client, env),
    },
  ],
})
export class ChatModule {}
