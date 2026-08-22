import { Module } from '@nestjs/common';
import { EncryptionService } from '../common/crypto/encryption.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, EncryptionService],
})
export class ConnectionsModule {}
