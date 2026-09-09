import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ReviewModule } from '../review/review.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [OrganizationsModule, ReviewModule, AiModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
