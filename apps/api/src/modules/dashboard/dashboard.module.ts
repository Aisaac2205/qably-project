import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RunsModule } from '../runs/runs.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [OrganizationsModule, RunsModule],
  controllers: [DashboardController, OverviewController, ChannelsController],
  providers: [DashboardService, OverviewService, ChannelsService],
})
export class DashboardModule {}
