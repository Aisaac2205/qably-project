import { Module } from '@nestjs/common';
import { OrgScopeGuard } from './guards/org-scope.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { PlanEntitlementsService } from './plan-entitlements.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgScopeGuard, PlanEntitlementsService],
  exports: [OrganizationsService, OrgScopeGuard, PlanEntitlementsService],
})
export class OrganizationsModule {}
