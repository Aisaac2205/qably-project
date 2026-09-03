import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE, type NotificationJobData } from './notifications.contracts';

@Injectable()
export class NotificationsPublisher {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<NotificationJobData>,
  ) {}

  async publish(event: NotificationJobData): Promise<void> {
    await this.queue.add(event.eventType, event);
  }
}
