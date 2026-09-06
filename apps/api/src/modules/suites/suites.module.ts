import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ReviewModule } from '../review/review.module';
import { SuitesController } from './suites.controller';
import { SuitesService } from './suites.service';

@Module({
  imports: [OrganizationsModule, ReviewModule],
  controllers: [SuitesController],
  providers: [SuitesService],
})
export class SuitesModule {}
