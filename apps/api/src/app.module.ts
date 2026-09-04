import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CredentialThrottlerGuard } from './common/throttler/credential-throttler.guard';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { ReviewModule } from './modules/review/review.module';
import { RunsModule } from './modules/runs/runs.module';
import { SuitesModule } from './modules/suites/suites.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
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
    NotificationsModule,
    IngestionModule,
    RunsModule,
    ReviewModule,
    DashboardModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CredentialThrottlerGuard }],
})
export class AppModule {}
