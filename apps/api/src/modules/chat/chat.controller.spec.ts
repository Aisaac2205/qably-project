import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AiEntitlementGuard } from '../ai/guards/ai-entitlement.guard';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ChatController } from './chat.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'qa@acme.test',
  name: 'QA',
  emailVerified: true,
  locale: null,
};

function fakeChat(result: unknown) {
  return {
    listThreads: jest.fn().mockResolvedValue(result),
    createThread: jest.fn().mockResolvedValue(result),
    getThread: jest.fn().mockResolvedValue(result),
    sendMessage: jest.fn().mockResolvedValue(result),
    sendToReview: jest.fn().mockResolvedValue(result),
  };
}

function build(chat: ReturnType<typeof fakeChat>) {
  return new ChatController(chat as never);
}

function throttleKeys(target: object): string[] {
  return Reflect.getMetadataKeys(target).filter((key) =>
    String(key).startsWith('THROTTLER:LIMIT'),
  );
}

describe('ChatController error codes', () => {
  it('throws a coded NotFoundException when the project does not exist', async () => {
    const chat = fakeChat({ ok: false, error: 'project-not-found' });

    await expect(
      build(chat).list(org, user, 'project-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(chat).list(org, user, 'project-1'),
    ).rejects.toMatchObject({ response: { code: 'project-not-found' } });
  });

  it('throws a coded NotFoundException when the conversation does not exist', async () => {
    const chat = fakeChat({ ok: false, error: 'thread-not-found' });

    await expect(
      build(chat).get(org, user, 'project-1', 'thread-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(chat).get(org, user, 'project-1', 'thread-1'),
    ).rejects.toMatchObject({ response: { code: 'thread-not-found' } });
  });

  it('throws a coded NotFoundException when the message does not exist', async () => {
    const chat = fakeChat({ ok: false, error: 'message-not-found' });

    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 0 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 0 },
      ),
    ).rejects.toMatchObject({ response: { code: 'message-not-found' } });
  });

  it('throws a coded NotFoundException when the assistant never suggested a case at that position', async () => {
    const chat = fakeChat({ ok: false, error: 'case-not-found' });

    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 4 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 4 },
      ),
    ).rejects.toMatchObject({ response: { code: 'case-not-found' } });
  });

  it('throws a coded UnprocessableEntityException when the project has no suite to receive the proposal', async () => {
    const chat = fakeChat({ ok: false, error: 'missing-suite' });

    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 0 },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 0 },
      ),
    ).rejects.toMatchObject({ response: { code: 'missing-suite' } });
  });

  it('throws a coded ServiceUnavailableException when the AI assistant is not available', async () => {
    const chat = fakeChat({ ok: false, error: 'provider-unavailable' });

    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', { content: 'Hi' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', { content: 'Hi' }),
    ).rejects.toMatchObject({ response: { code: 'provider-unavailable' } });
  });

  it('throws a coded ForbiddenException when AI features are not enabled for the organization', async () => {
    const chat = fakeChat({ ok: false, error: 'ai-not-enabled' });

    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', { content: 'Hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', { content: 'Hi' }),
    ).rejects.toMatchObject({ response: { code: 'ai-not-enabled' } });
  });

  it('throws a coded UnprocessableEntityException when the stored suggested cases are corrupt', async () => {
    const chat = fakeChat({ ok: false, error: 'invalid-suggested-cases' });

    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 0 },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      build(chat).sendToReview(
        org,
        user,
        'project-1',
        'thread-1',
        'message-1',
        { caseIndex: 0 },
      ),
    ).rejects.toMatchObject({ response: { code: 'invalid-suggested-cases' } });
  });
});

describe('ChatController guard and throttle wiring', () => {
  it('scopes every route to the current organization', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ChatController)).toContain(
      OrgScopeGuard,
    );
  });

  it('gates sending a message behind the AI entitlement guard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatController.prototype.send),
    ).toContain(AiEntitlementGuard);
  });

  it('does not gate thread listing, creation or reading behind the AI entitlement guard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatController.prototype.list),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatController.prototype.create),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatController.prototype.get),
    ).toBeUndefined();
  });

  it('throttles thread creation and message sending against runaway cost', () => {
    expect(
      throttleKeys(ChatController.prototype.create).length,
    ).toBeGreaterThan(0);
    expect(throttleKeys(ChatController.prototype.send).length).toBeGreaterThan(
      0,
    );
  });

  it('does not throttle reading threads or sending a case to review', () => {
    expect(throttleKeys(ChatController.prototype.list)).toHaveLength(0);
    expect(throttleKeys(ChatController.prototype.get)).toHaveLength(0);
    expect(throttleKeys(ChatController.prototype.sendToReview)).toHaveLength(
      0,
    );
  });
});
