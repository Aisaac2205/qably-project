import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENTS,
  type ScmEventFailedEvent,
} from '../../common/events/domain-events';
import { NotificationsPublisher } from './notifications.publisher';

@Injectable()
export class NotificationsSubscriber {
  private readonly logger = new Logger(NotificationsSubscriber.name);

  constructor(private readonly publisher: NotificationsPublisher) {}

  @OnEvent(DOMAIN_EVENTS.scmEventFailed, { async: true })
  async onScmEventFailed(event: ScmEventFailedEvent): Promise<void> {
    try {
      await this.publisher.publish({
        eventType: 'ingestion_failed',
        organizationId: event.organizationId,
        severity: 'high',
        payload: { repo: event.repo },
        dedupeKey: `ingestion_failed:${event.scmEventId}`,
        connectionId: event.connectionId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to notify the ingestion failure of SCM event ${event.scmEventId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
