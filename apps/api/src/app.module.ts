import { Module } from '@nestjs/common';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { SuitesModule } from './modules/suites/suites.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    OrganizationsModule,
    ProjectsModule,
    RepositoryModule,
    SuitesModule,
    ConnectionsModule,
    ApiKeysModule,
    IngestionModule,
  ],
})
export class AppModule {}
