import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RunsModule } from '../runs/runs.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [OrganizationsModule, RunsModule],
  controllers: [DashboardController, OverviewController],
  providers: [DashboardService, OverviewService],
})
export class DashboardModule {}
