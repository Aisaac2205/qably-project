import { Global, Module } from '@nestjs/common';
import { ENV } from './config.tokens';
import { parseEnv } from './env';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }],
  exports: [ENV],
})
export class ConfigModule {}
