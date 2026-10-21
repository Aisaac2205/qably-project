import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENTS,
  type ExtractionCappedEvent,
  type ProposalsCreatedEvent,
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

  /**
   * A skipped push is a silent loss unless someone is told, so it is high
   * severity. The key is the batch: one push reaches every project of its
   * connection, and each project skips its own batch. Like a push's
   * `proposals_ready`, the row carries the ingestion batch.
   */
  @OnEvent(DOMAIN_EVENTS.extractionCapped, { async: true })
  async onExtractionCapped(event: ExtractionCappedEvent): Promise<void> {
    try {
      await this.publisher.publish({
        eventType: 'extraction_capped',
        organizationId: event.organizationId,
        severity: 'high',
        payload: {
          count: event.fileCount,
          limit: event.limit,
          projectId: event.projectId,
          batchId: event.batchId,
        },
        dedupeKey: `extraction_capped:${event.batchId}`,
        projectId: event.projectId,
        ingestionBatchId: event.batchId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to notify the capped extraction of batch ${event.batchId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * One notification per batch, not per occurrence: a push with several test
   * files raises this event once per file, all with the same `batchId`, so the
   * dedupe key is the batch and the processor refreshes the count in place.
   * The key uses the ingestion batch, not the SCM event: one push reaches every
   * project of its connection, and each project has its own batch and inbox.
   */
  @OnEvent(DOMAIN_EVENTS.proposalsCreated, { async: true })
  async onProposalsCreated(event: ProposalsCreatedEvent): Promise<void> {
    try {
      await this.publisher.publish({
        eventType: 'proposals_ready',
        organizationId: event.organizationId,
        severity: 'medium',
        payload: {
          source: event.source,
          count: event.count,
          projectId: event.projectId,
          batchId: event.batchId,
          ...(event.commitSha === undefined
            ? {}
            : { commitSha: event.commitSha }),
          ...(event.author === undefined ? {} : { author: event.author }),
          ...(event.branch === undefined ? {} : { branch: event.branch }),
        },
        dedupeKey: `proposals:${event.source}:${event.batchId}`,
        projectId: event.projectId,
        ...(event.source === 'push' ? { ingestionBatchId: event.batchId } : {}),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to notify the proposals of ${event.source} batch ${event.batchId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
