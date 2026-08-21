import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
