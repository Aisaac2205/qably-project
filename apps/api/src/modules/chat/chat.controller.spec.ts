import { EventEmitter } from 'node:events';
import {
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  RequestMethod,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import type { Response } from 'express';
import { AiEntitlementGuard } from '../ai/guards/ai-entitlement.guard';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { ChatError, ChatStreamEvent } from './chat.contracts';
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
    streamMessage: jest.fn(),
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

  it('throws a coded ServiceUnavailableException when the daily Aeris budget is exhausted', async () => {
    const chat = fakeChat({ ok: false, error: 'quota-exhausted' });

    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', { content: 'Hi' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', { content: 'Hi' }),
    ).rejects.toMatchObject({ response: { code: 'quota-exhausted' } });
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

  it('throws a coded UnprocessableEntityException when the suggestion has no code-backed evidence', async () => {
    const chat = fakeChat({ ok: false, error: 'no-code-evidence' });

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
    ).rejects.toMatchObject({ response: { code: 'no-code-evidence' } });
  });

  it('throws a coded UnprocessableEntityException when the attached file cannot be read', async () => {
    const chat = fakeChat({ ok: false, error: 'file-unreadable' });

    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', {
        content: 'Hi',
        filePath: 'src/missing.ts',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      build(chat).send(org, user, 'project-1', 'thread-1', {
        content: 'Hi',
        filePath: 'src/missing.ts',
      }),
    ).rejects.toMatchObject({ response: { code: 'file-unreadable' } });
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

/** Just enough of an express Response to observe a server-sent stream. */
class FakeResponse extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  headersSent = false;
  writableEnded = false;
  writableFinished = false;
  destroyed = false;
  private readonly chunks: string[] = [];

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  flushHeaders(): void {
    this.headersSent = true;
  }

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  end(): this {
    if (this.writableEnded) return this;
    this.writableEnded = true;
    this.writableFinished = !this.destroyed;
    this.emit('close');
    return this;
  }

  /** The client goes away before the response is complete. */
  disconnect(): void {
    this.destroyed = true;
    this.emit('close');
  }

  body(): string {
    return this.chunks.join('');
  }

  asExpress(): Response {
    return this as unknown as Response;
  }
}

function sse(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamOf(
  ...events: ChatStreamEvent[]
): () => AsyncGenerator<ChatStreamEvent> {
  return async function* () {
    for (const event of events) {
      await Promise.resolve();
      yield event;
    }
  };
}

const userMessage = { id: 'message-1', role: 'user', content: 'Hi' };
const assistantMessage = {
  id: 'message-2',
  role: 'assistant',
  content: 'Hello',
};
const doneEvent = {
  type: 'done',
  userMessage,
  assistantMessage,
} as unknown as ChatStreamEvent;

function sendStream(
  chat: ReturnType<typeof fakeChat>,
  response: FakeResponse,
): Promise<void> {
  return build(chat).sendStream(
    org,
    user,
    'project-1',
    'thread-1',
    { content: 'Hi' },
    response.asExpress(),
  );
}

describe('ChatController streamed send', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers with server-sent event headers, one framed event per delta, then done', async () => {
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(
      streamOf(
        { type: 'delta', text: 'Hel' },
        { type: 'delta', text: 'lo "there"\n' },
        doneEvent,
      ),
    );
    const response = new FakeResponse();

    await sendStream(chat, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    expect(response.headersSent).toBe(true);
    expect(response.body()).toBe(
      sse('delta', { text: 'Hel' }) +
        sse('delta', { text: 'lo "there"\n' }) +
        sse('done', { userMessage, assistantMessage }),
    );
    expect(response.writableEnded).toBe(true);
    expect(chat.streamMessage).toHaveBeenCalledWith(
      org,
      user,
      'project-1',
      'thread-1',
      { content: 'Hi' },
      expect.any(AbortSignal),
    );
  });

  it('frames a case preview event between the deltas and done', async () => {
    const suggestedCase = {
      title: 'Rejects an expired card',
      objective: 'Confirm expired cards are refused',
      preconditions: [],
      steps: ['Open checkout'],
      expectedResult: 'The payment is refused',
      priority: 'high',
    };
    const caseEvent = {
      type: 'case',
      index: 0,
      case: suggestedCase,
    } as unknown as ChatStreamEvent;
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(
      streamOf({ type: 'delta', text: 'Here' }, caseEvent, doneEvent),
    );
    const response = new FakeResponse();

    await sendStream(chat, response);

    expect(response.body()).toBe(
      sse('delta', { text: 'Here' }) +
        sse('case', { index: 0, case: suggestedCase }) +
        sse('done', { userMessage, assistantMessage }),
    );
  });

  it('starts the stream with done when the reply produced no preview text', async () => {
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(streamOf(doneEvent));
    const response = new FakeResponse();

    await sendStream(chat, response);

    expect(response.statusCode).toBe(200);
    expect(response.body()).toBe(
      sse('done', { userMessage, assistantMessage }),
    );
  });

  it.each<ChatError>([
    'quota-exhausted',
    'provider-unavailable',
    'ai-not-enabled',
    'too-many-cases',
    'case-not-found',
    'thread-not-found',
    'file-unreadable',
  ])(
    'throws the same HTTP error as the plain send when the stream fails with %s before any text',
    async (error) => {
      const chat = fakeChat({ ok: false, error });
      chat.streamMessage.mockImplementation(
        streamOf({ type: 'failed', error }),
      );
      const response = new FakeResponse();

      const plain = (await build(chat)
        .send(org, user, 'project-1', 'thread-1', { content: 'Hi' })
        .catch((thrown: unknown) => thrown)) as HttpException;
      const streamed = (await sendStream(chat, response).catch(
        (thrown: unknown) => thrown,
      )) as HttpException;

      expect(streamed).toBeInstanceOf(plain.constructor);
      expect(streamed.getStatus()).toBe(plain.getStatus());
      expect(streamed.getResponse()).toEqual(plain.getResponse());
      expect(response.headersSent).toBe(false);
      expect(response.body()).toBe('');
    },
  );

  it('sends a failure after the stream started as an error event, then ends the response', async () => {
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(
      streamOf(
        { type: 'delta', text: 'Hel' },
        { type: 'failed', error: 'provider-unavailable' },
      ),
    );
    const response = new FakeResponse();

    await sendStream(chat, response);

    expect(response.statusCode).toBe(200);
    expect(response.body()).toBe(
      sse('delta', { text: 'Hel' }) +
        sse('error', {
          code: 'provider-unavailable',
          message: 'The AI assistant is not available right now',
        }),
    );
    expect(response.writableEnded).toBe(true);
  });

  it('sends a credit refusal after the stream started as an ai-not-enabled error event', async () => {
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(
      streamOf(
        { type: 'delta', text: 'Hel' },
        { type: 'failed', error: 'ai-not-enabled' },
      ),
    );
    const response = new FakeResponse();

    await sendStream(chat, response);

    expect(response.body()).toContain(
      sse('error', {
        code: 'ai-not-enabled',
        message: 'AI features are not enabled for this organization',
      }),
    );
  });

  it('sends an unexpected failure after the stream started as an error event instead of an HTTP error', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(async function* () {
      await Promise.resolve();
      yield { type: 'delta', text: 'Hel' };
      throw new Error('db unavailable');
    });
    const response = new FakeResponse();

    await expect(sendStream(chat, response)).resolves.toBeUndefined();

    expect(response.body()).toBe(
      sse('delta', { text: 'Hel' }) +
        sse('error', {
          code: 'internal-error',
          message: 'Internal server error',
        }),
    );
    expect(response.writableEnded).toBe(true);
  });

  it('aborts the stream when the client disconnects before it completes, and writes nothing more', async () => {
    const chat = fakeChat(undefined);
    const response = new FakeResponse();
    let abortedAfterDisconnect: boolean | undefined;
    chat.streamMessage.mockImplementation(async function* (...args: unknown[]) {
      const signal = args[5] as AbortSignal;
      await Promise.resolve();
      yield { type: 'delta', text: 'Hel' };
      response.disconnect();
      abortedAfterDisconnect = signal.aborted;
    });

    await sendStream(chat, response);

    expect(abortedAfterDisconnect).toBe(true);
    expect(response.body()).toBe(sse('delta', { text: 'Hel' }));
  });

  it('aborts the stream when the client disconnects before the first event', async () => {
    const chat = fakeChat(undefined);
    const response = new FakeResponse();
    let aborted: boolean | undefined;
    chat.streamMessage.mockImplementation(async function* (...args: unknown[]) {
      const signal = args[5] as AbortSignal;
      await Promise.resolve();
      response.disconnect();
      aborted = signal.aborted;
      yield* [];
    });

    await sendStream(chat, response);

    expect(aborted).toBe(true);
    expect(response.headersSent).toBe(false);
    expect(response.body()).toBe('');
  });

  it('leaves the signal alone once the response completed normally', async () => {
    const chat = fakeChat(undefined);
    chat.streamMessage.mockImplementation(streamOf(doneEvent));
    const response = new FakeResponse();

    await sendStream(chat, response);

    const signal = (chat.streamMessage.mock.calls[0] as unknown[])[5];
    expect((signal as AbortSignal).aborted).toBe(false);
  });

  it('routes POST :threadId/messages/stream behind the AI entitlement guard, throttled like the plain send', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler('sendStream'))).toBe(
      ':threadId/messages/stream',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler('sendStream'))).toBe(
      RequestMethod.POST,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, handler('sendStream')),
    ).toContain(AiEntitlementGuard);

    const keys = throttleKeys(handler('send'));
    expect(keys.length).toBeGreaterThan(0);
    expect(throttleKeys(handler('sendStream'))).toEqual(keys);
    for (const key of keys) {
      expect(Reflect.getMetadata(key, handler('sendStream'))).toEqual(
        Reflect.getMetadata(key, handler('send')),
      );
    }
  });
});
