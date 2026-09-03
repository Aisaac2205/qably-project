import { Module } from '@nestjs/common';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { AuthModule } from '../../auth/auth.module';
import { OrganizationsModule } from '../../organizations/organizations.module';
import { DiscordChannel } from './channels/discord.channel';
import { SlackChannel } from './channels/slack.channel';
import { NotificationWebhooksController } from './webhooks.controller';
import { NotificationWebhooksService } from './webhooks.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [NotificationWebhooksController],
  providers: [
    NotificationWebhooksService,
    EncryptionService,
    SlackChannel,
    DiscordChannel,
  ],
  exports: [EncryptionService, SlackChannel, DiscordChannel],
})
export class NotificationWebhooksModule {}
