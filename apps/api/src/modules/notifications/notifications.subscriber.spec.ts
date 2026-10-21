import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DOMAIN_EVENTS,
  type ExtractionCappedEvent,
  type ProposalApprovedEvent,
  type ProposalsCreatedEvent,
  type ScmEventFailedEvent,
} from '../../common/events/domain-events';
import { DomainEvents } from '../../common/events/domain-events.service';
import { DomainEventsModule } from '../../common/events/domain-events.module';
import { NotificationsPublisher } from './notifications.publisher';
import { NotificationsSubscriber } from './notifications.subscriber';

const failed: ScmEventFailedEvent = {
  scmEventId: 'scm-event-1',
  organizationId: 'org-1',
  repo: 'acme/shop',
  connectionId: 'connection-1',
};

const approved: ProposalApprovedEvent = {
  proposalId: 'proposal-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  testCaseId: 'case-1',
  versionId: 'version-1',
  createdNewCase: true,
  actorId: 'user-1',
};

const pushProposals: ProposalsCreatedEvent = {
  source: 'push',
  organizationId: 'org-1',
  projectId: 'project-1',
  batchId: 'batch-1',
  count: 3,
  commitSha: 'abc1234def',
  author: 'ada',
  branch: 'main',
};

const capped: ExtractionCappedEvent = {
  organizationId: 'org-1',
  projectId: 'project-1',
  batchId: 'batch-1',
  fileCount: 120,
  limit: 50,
};

const chatProposal: ProposalsCreatedEvent = {
  source: 'chat',
  organizationId: 'org-1',
  projectId: 'project-1',
  batchId: 'proposal-9',
  count: 1,
};

// The subscriber runs on setImmediate (`async: true`); one more macrotask is
// enough for it to have been invoked.
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('NotificationsSubscriber', () => {
  let moduleRef: TestingModule;
  let events: DomainEvents;
  let publish: jest.Mock;

  beforeEach(async () => {
    publish = jest.fn().mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      imports: [DomainEventsModule],
      providers: [
        NotificationsSubscriber,
        { provide: NotificationsPublisher, useValue: { publish } },
      ],
    }).compile();
    await moduleRef.init();
    events = moduleRef.get(DomainEvents);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('publishes exactly one high-severity ingestion_failed notification for a failed SCM event', async () => {
    events.publish(DOMAIN_EVENTS.scmEventFailed, failed);
    await flush();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      eventType: 'ingestion_failed',
      organizationId: 'org-1',
      severity: 'high',
      payload: { repo: 'acme/shop' },
      dedupeKey: 'ingestion_failed:scm-event-1',
      connectionId: 'connection-1',
    });
  });

  it('does not run before the publisher has returned', () => {
    events.publish(DOMAIN_EVENTS.scmEventFailed, failed);

    expect(publish).not.toHaveBeenCalled();
  });

  it('ignores events that are not about a failed SCM event', async () => {
    events.publish(DOMAIN_EVENTS.proposalApproved, approved);
    await flush();

    expect(publish).not.toHaveBeenCalled();
  });

  it('never lets a failing notification publish reach the emitter, and logs it', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    publish.mockRejectedValue(new Error('redis is down'));

    expect(() =>
      events.publish(DOMAIN_EVENTS.scmEventFailed, failed),
    ).not.toThrow();
    await flush();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('scm-event-1');
    expect(message).toContain('redis is down');
    warn.mockRestore();
  });

  it('survives a notification publish that throws synchronously', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    publish.mockImplementation(() => {
      throw new Error('queue misconfigured');
    });

    expect(() =>
      events.publish(DOMAIN_EVENTS.scmEventFailed, failed),
    ).not.toThrow();
    await flush();

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  describe('extraction capped', () => {
    it('publishes one high-severity extraction_capped notification keyed by the batch', async () => {
      events.publish(DOMAIN_EVENTS.extractionCapped, capped);
      await flush();

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith({
        eventType: 'extraction_capped',
        organizationId: 'org-1',
        severity: 'high',
        payload: {
          count: 120,
          limit: 50,
          projectId: 'project-1',
          batchId: 'batch-1',
        },
        dedupeKey: 'extraction_capped:batch-1',
        projectId: 'project-1',
      });
    });

    it('keys two projects of the same push apart, because each project owns its own batch', async () => {
      events.publish(DOMAIN_EVENTS.extractionCapped, capped);
      events.publish(DOMAIN_EVENTS.extractionCapped, {
        ...capped,
        projectId: 'project-2',
        batchId: 'batch-2',
      });
      await flush();

      const keys = (publish.mock.calls as [{ dedupeKey: string }][]).map(
        ([call]) => call.dedupeKey,
      );
      expect(keys).toEqual([
        'extraction_capped:batch-1',
        'extraction_capped:batch-2',
      ]);
    });

    it('never lets a failing publish reach the emitter, and logs the batch', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      publish.mockRejectedValue(new Error('redis is down'));

      expect(() =>
        events.publish(DOMAIN_EVENTS.extractionCapped, capped),
      ).not.toThrow();
      await flush();

      expect(warn).toHaveBeenCalledTimes(1);
      const [message] = warn.mock.calls[0] as [string];
      expect(message).toContain('batch-1');
      expect(message).toContain('redis is down');
      warn.mockRestore();
    });

    it('is not triggered by created proposals', async () => {
      events.publish(DOMAIN_EVENTS.proposalsCreated, pushProposals);
      await flush();

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'proposals_ready' }),
      );
    });
  });

  describe('proposals created', () => {
    it('publishes one medium-severity proposals_ready notification keyed by the push batch', async () => {
      events.publish(DOMAIN_EVENTS.proposalsCreated, pushProposals);
      await flush();

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith({
        eventType: 'proposals_ready',
        organizationId: 'org-1',
        severity: 'medium',
        payload: {
          source: 'push',
          count: 3,
          projectId: 'project-1',
          batchId: 'batch-1',
          commitSha: 'abc1234def',
          author: 'ada',
          branch: 'main',
        },
        dedupeKey: 'proposals:push:batch-1',
        projectId: 'project-1',
        ingestionBatchId: 'batch-1',
      });
    });

    it('keys two projects of the same push apart, because each project owns its own batch', async () => {
      events.publish(DOMAIN_EVENTS.proposalsCreated, pushProposals);
      events.publish(DOMAIN_EVENTS.proposalsCreated, {
        ...pushProposals,
        projectId: 'project-2',
        batchId: 'batch-2',
      });
      await flush();

      const keys = (publish.mock.calls as [{ dedupeKey: string }][]).map(
        ([call]) => call.dedupeKey,
      );
      expect(keys).toEqual([
        'proposals:push:batch-1',
        'proposals:push:batch-2',
      ]);
    });

    it('keeps the same key when another job of the same push batch finishes, so the notification is updated in place', async () => {
      events.publish(DOMAIN_EVENTS.proposalsCreated, pushProposals);
      events.publish(DOMAIN_EVENTS.proposalsCreated, {
        ...pushProposals,
        count: 5,
      });
      await flush();

      const keys = (publish.mock.calls as [{ dedupeKey: string }][]).map(
        ([call]) => call.dedupeKey,
      );
      expect(new Set(keys).size).toBe(1);
    });

    it('leaves the ingestion batch column empty for a source that has no ingestion batch, and omits the push-only fields', async () => {
      events.publish(DOMAIN_EVENTS.proposalsCreated, chatProposal);
      await flush();

      expect(publish).toHaveBeenCalledWith({
        eventType: 'proposals_ready',
        organizationId: 'org-1',
        severity: 'medium',
        payload: {
          source: 'chat',
          count: 1,
          projectId: 'project-1',
          batchId: 'proposal-9',
        },
        dedupeKey: 'proposals:chat:proposal-9',
        projectId: 'project-1',
      });
    });

    it('leaves out a push field the SCM event did not carry instead of publishing an empty one', async () => {
      events.publish(DOMAIN_EVENTS.proposalsCreated, {
        ...pushProposals,
        author: undefined,
        branch: undefined,
      });
      await flush();

      const [call] = publish.mock.calls[0] as [
        { payload: Record<string, unknown> },
      ];
      expect(call.payload).toEqual({
        source: 'push',
        count: 3,
        projectId: 'project-1',
        batchId: 'batch-1',
        commitSha: 'abc1234def',
      });
    });

    it('never lets a failing publish reach the emitter, and logs the batch', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      publish.mockRejectedValue(new Error('redis is down'));

      expect(() =>
        events.publish(DOMAIN_EVENTS.proposalsCreated, pushProposals),
      ).not.toThrow();
      await flush();

      expect(warn).toHaveBeenCalledTimes(1);
      const [message] = warn.mock.calls[0] as [string];
      expect(message).toContain('batch-1');
      expect(message).toContain('redis is down');
      warn.mockRestore();
    });

    it('is not triggered by a failed SCM event', async () => {
      events.publish(DOMAIN_EVENTS.scmEventFailed, failed);
      await flush();

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ingestion_failed' }),
      );
    });
  });
});
