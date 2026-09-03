import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mailer/mailer.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATIONS_QUEUE } from './notifications.contracts';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsPublisher } from './notifications.publisher';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    MailerModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ENV],
      useFactory: (env: Env) => ({ connection: { url: env.REDIS_URL } }),
    }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsPublisher, NotificationsProcessor],
  exports: [NotificationsPublisher],
})
export class NotificationsModule {}
