import { Module } from '@nestjs/common';
import { OrgScopeGuard } from './guards/org-scope.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgScopeGuard],
  exports: [OrganizationsService, OrgScopeGuard],
})
export class OrganizationsModule {}
