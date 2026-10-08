import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENTS,
  type ProposalApprovedEvent,
  type ProposalRejectedEvent,
} from './domain-events';
import { DomainEvents } from './domain-events.service';

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
  suiteId: null,
  decisionId: 'decision-1',
  actorId: 'user-1',
};

function build(emit: jest.Mock = jest.fn()): {
  events: DomainEvents;
  emit: jest.Mock;
} {
  return {
    events: new DomainEvents({ emit } as unknown as EventEmitter2),
    emit,
  };
}

describe('DomainEvents.publish', () => {
  it('emits the event name together with its payload, once', () => {
    const { events, emit } = build();

    events.publish(DOMAIN_EVENTS.proposalApproved, approved);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('proposal.approved', approved);
  });

  it('emits every event under the name its constant declares', () => {
    const { events, emit } = build();

    events.publish(DOMAIN_EVENTS.proposalRejected, rejected);

    expect(emit).toHaveBeenCalledWith('proposal.rejected', rejected);
  });

  it('delivers the payload to a listener registered on the real emitter', () => {
    const emitter = new EventEmitter2();
    const listener = jest.fn();
    emitter.on(DOMAIN_EVENTS.proposalApproved, listener);

    new DomainEvents(emitter).publish(DOMAIN_EVENTS.proposalApproved, approved);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(approved);
  });

  it('never throws when the emitter fails, and logs the failure without the payload', () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { events } = build(
      jest.fn().mockImplementation(() => {
        throw new Error('listener exploded');
      }),
    );

    expect(() =>
      events.publish(DOMAIN_EVENTS.proposalApproved, approved),
    ).not.toThrow();

    expect(error).toHaveBeenCalledTimes(1);
    const [message] = error.mock.calls[0] as [string];
    expect(message).toContain('proposal.approved');
    expect(message).toContain('listener exploded');
    expect(message).not.toContain('proposal-1');
    expect(message).not.toContain('user-1');
    error.mockRestore();
  });

  it('never throws when the emitter fails with something that is not an Error', () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const failure: unknown = 'plain string failure';
    const { events } = build(
      jest.fn().mockImplementation(() => {
        throw failure;
      }),
    );

    expect(() =>
      events.publish(DOMAIN_EVENTS.proposalRejected, rejected),
    ).not.toThrow();

    expect(error).toHaveBeenCalledTimes(1);
    const [message] = error.mock.calls[0] as [string];
    expect(message).toContain('plain string failure');
    error.mockRestore();
  });
});
