import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [ApiKeysModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
