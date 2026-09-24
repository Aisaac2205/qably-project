import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ReviewModule } from '../review/review.module';
import { SuiteCasesService } from './suite-cases.service';
import { SuiteViewAssembler } from './suite-view.assembler';
import { SuitesController } from './suites.controller';
import { SuitesService } from './suites.service';

@Module({
  imports: [OrganizationsModule, ReviewModule, AiModule],
  controllers: [SuitesController],
  providers: [SuitesService, SuiteCasesService, SuiteViewAssembler],
})
export class SuitesModule {}
