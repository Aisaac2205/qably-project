import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RunQueriesController } from './run-queries.controller';
import { RunQueriesService } from './run-queries.service';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [ApiKeysModule, OrganizationsModule],
  controllers: [RunsController, RunQueriesController],
  providers: [RunsService, RunQueriesService],
})
export class RunsModule {}
