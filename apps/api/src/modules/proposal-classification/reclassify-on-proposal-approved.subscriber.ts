import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENTS,
  type ProposalApprovedEvent,
} from '../../common/events/domain-events';
import { ProposalReclassifier } from './proposal-reclassifier';

@Injectable()
export class ReclassifyOnProposalApproved {
  private readonly logger = new Logger(ReclassifyOnProposalApproved.name);

  constructor(private readonly reclassifier: ProposalReclassifier) {}

  @OnEvent(DOMAIN_EVENTS.proposalApproved, { async: true })
  async handle(event: ProposalApprovedEvent): Promise<void> {
    try {
      await this.reclassifier.enqueue(event.suiteId);
    } catch (error) {
      this.logger.warn(
        `Failed to reclassify suite ${event.suiteId ?? 'unknown'} after approving proposal ${event.proposalId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
