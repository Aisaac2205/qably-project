import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RepositoryController } from './repository.controller';
import { RepositoryService } from './repository.service';

@Module({
  imports: [OrganizationsModule, ConnectionsModule],
  controllers: [RepositoryController],
  providers: [RepositoryService],
})
export class RepositoryModule {}
