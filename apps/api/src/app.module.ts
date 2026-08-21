import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    OrganizationsModule,
    ProjectsModule,
  ],
})
export class AppModule {}
