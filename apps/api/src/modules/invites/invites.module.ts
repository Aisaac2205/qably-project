import { Module } from '@nestjs/common';
import { MailerModule } from '../mailer/mailer.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { InvitesController } from './invites.controller';
import { OrgInvitesController } from './org-invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [OrganizationsModule, MailerModule],
  controllers: [InvitesController, OrgInvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
