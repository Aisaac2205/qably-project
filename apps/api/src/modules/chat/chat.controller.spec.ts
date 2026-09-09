import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
} from '@nestjs/common/constants';
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
    deleteThread: jest.fn().mockResolvedValue(result),
  };
}

function build(chat: ReturnType<typeof fakeChat>) {
  return new ChatController(chat as never);
}

function handler(name: keyof ChatController): object {
  return (ChatController.prototype as unknown as Record<string, object>)[name];
}

function throttleKeys(target: object): string[] {
  const keys: unknown[] = Reflect.getMetadataKeys(target);
  return keys
    .map((key) => String(key))
    .filter((key) => key.startsWith('THROTTLER:LIMIT'));
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
    expect(Reflect.getMetadata(GUARDS_METADATA, handler('send'))).toContain(
      AiEntitlementGuard,
    );
  });

  it('does not gate thread listing, creation or reading behind the AI entitlement guard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, handler('list')),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, handler('create')),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, handler('get')),
    ).toBeUndefined();
  });

  it('throttles thread creation and message sending against runaway cost', () => {
    expect(throttleKeys(handler('create')).length).toBeGreaterThan(0);
    expect(throttleKeys(handler('send')).length).toBeGreaterThan(0);
  });

  it('does not throttle reading threads or sending a case to review', () => {
    expect(throttleKeys(handler('list'))).toHaveLength(0);
    expect(throttleKeys(handler('get'))).toHaveLength(0);
    expect(throttleKeys(handler('sendToReview'))).toHaveLength(0);
  });

  it('answers a thread deletion with no content', async () => {
    const chat = fakeChat({ ok: true, value: undefined });

    await expect(
      build(chat).remove(org, user, 'project-1', 'thread-1'),
    ).resolves.toBeUndefined();
    expect(chat.deleteThread).toHaveBeenCalledWith(
      org,
      user,
      'project-1',
      'thread-1',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler('remove'))).toBe(
      204,
    );
  });

  it('throws a coded NotFoundException when deleting a conversation that does not exist', async () => {
    const chat = fakeChat({ ok: false, error: 'thread-not-found' });

    await expect(
      build(chat).remove(org, user, 'project-1', 'thread-1'),
    ).rejects.toMatchObject({ response: { code: 'thread-not-found' } });
  });

  it('does not gate thread deletion behind the AI entitlement guard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, handler('remove')),
    ).toBeUndefined();
  });
});
