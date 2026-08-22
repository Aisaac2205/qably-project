import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SuitesController } from './suites.controller';
import { SuitesService } from './suites.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [SuitesController],
  providers: [SuitesService],
})
export class SuitesModule {}
