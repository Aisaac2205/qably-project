import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RunsModule } from '../runs/runs.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [OrganizationsModule, RunsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
