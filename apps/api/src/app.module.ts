import { Module } from '@nestjs/common';
import { ThrottlingModule } from './common/throttler/throttling.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InvitesModule } from './modules/invites/invites.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReporterModule } from './reporter/reporter.module';
import { ReviewModule } from './modules/review/review.module';
import { RunsModule } from './modules/runs/runs.module';
import { SuitesModule } from './modules/suites/suites.module';

@Module({
  imports: [
    ThrottlingModule,
    ConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    OrganizationsModule,
    InvitesModule,
    ProjectsModule,
    RepositoryModule,
    SuitesModule,
    ConnectionsModule,
    ApiKeysModule,
    NotificationsModule,
    IngestionModule,
    RunsModule,
    ReviewModule,
    ChatModule,
    DashboardModule,
    ReporterModule,
  ],
})
export class AppModule {}
