import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
