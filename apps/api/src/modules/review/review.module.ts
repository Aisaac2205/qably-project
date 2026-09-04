import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ExtractionService } from './extraction.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [ReviewController],
  providers: [ReviewService, ExtractionService],
  exports: [ExtractionService],
})
export class ReviewModule {}
