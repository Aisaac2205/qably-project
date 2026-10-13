import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DOMAIN_EVENTS,
  type ProposalApprovedEvent,
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
});
