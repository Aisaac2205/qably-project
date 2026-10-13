import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DOMAIN_EVENTS,
  type ProposalApprovedEvent,
  type ProposalRejectedEvent,
} from '../../common/events/domain-events';
import { DomainEvents } from '../../common/events/domain-events.service';
import { DomainEventsModule } from '../../common/events/domain-events.module';
import { ProposalReclassifier } from './proposal-reclassifier';
import { ReclassifyOnProposalApproved } from './reclassify-on-proposal-approved.subscriber';

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

const rejected: ProposalRejectedEvent = {
  proposalId: 'proposal-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  suiteId: 'suite-1',
  decisionId: 'decision-1',
  actorId: 'user-1',
};

// The subscriber runs on setImmediate (`async: true`); one more macrotask is
// enough for it to have been invoked.
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ReclassifyOnProposalApproved', () => {
  let moduleRef: TestingModule;
  let events: DomainEvents;
  let enqueue: jest.Mock;

  beforeEach(async () => {
    enqueue = jest.fn().mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      imports: [DomainEventsModule],
      providers: [
        ReclassifyOnProposalApproved,
        { provide: ProposalReclassifier, useValue: { enqueue } },
      ],
    }).compile();
    await moduleRef.init();
    events = moduleRef.get(DomainEvents);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('enqueues exactly one reclassify job for the suite of an approved proposal', async () => {
    events.publish(DOMAIN_EVENTS.proposalApproved, approved);
    await flush();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('suite-1');
  });

  it('passes a null suite through, since the reclassifier ignores it', async () => {
    events.publish(DOMAIN_EVENTS.proposalApproved, {
      ...approved,
      suiteId: null,
    });
    await flush();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(null);
  });

  it('does not run before the publisher has returned', () => {
    events.publish(DOMAIN_EVENTS.proposalApproved, approved);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('ignores a rejected proposal, since nothing about the case identity changed', async () => {
    events.publish(DOMAIN_EVENTS.proposalRejected, rejected);
    await flush();

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('never lets a failing enqueue reach the publisher, and logs it', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    enqueue.mockRejectedValue(new Error('redis is down'));

    expect(() =>
      events.publish(DOMAIN_EVENTS.proposalApproved, approved),
    ).not.toThrow();
    await flush();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('suite-1');
    expect(message).toContain('redis is down');
    warn.mockRestore();
  });

  it('survives an enqueue that throws synchronously', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    enqueue.mockImplementation(() => {
      throw new Error('queue misconfigured');
    });

    expect(() =>
      events.publish(DOMAIN_EVENTS.proposalApproved, approved),
    ).not.toThrow();
    await flush();

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
