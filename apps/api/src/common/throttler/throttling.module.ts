import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CredentialThrottlerGuard } from './credential-throttler.guard';
import { throttlerOptions } from './throttler.config';

@Module({
  imports: [ThrottlerModule.forRoot(throttlerOptions)],
  providers: [{ provide: APP_GUARD, useClass: CredentialThrottlerGuard }],
})
export class ThrottlingModule {}
