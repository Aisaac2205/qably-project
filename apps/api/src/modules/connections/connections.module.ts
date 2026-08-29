import { Module } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { GithubRepoDirectory } from './adapters/github-repo.directory';
import { ConnectionsController } from './connections.controller';
import { REPO_DIRECTORY } from './connections.contracts';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [ConnectionsController],
  providers: [
    ConnectionsService,
    EncryptionService,
    { provide: REPO_DIRECTORY, useClass: GithubRepoDirectory },
  ],
})
export class ConnectionsModule {}
