import { Logger } from '@nestjs/common';
import { DEFAULT_LOCALE } from '@qably/i18n';
import type { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { ChatAssistant, ChatReplyOutcome } from './chat.assistant';
import { CHAT_PROMPT_VERSION } from './chat.contracts';
import { ChatService } from './chat.service';

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

const threadRow = {
  id: 'thread-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  userId: 'user-1',
  title: 'Checkout gaps',
  createdAt: new Date('2026-09-05T10:00:00.000Z'),
  updatedAt: new Date('2026-09-05T10:05:00.000Z'),
};

const suggestedCase = {
  title: 'Rejects an expired card',
  objective: 'Confirm expired cards are refused',
  preconditions: ['A cart with one item'],
  steps: ['Open checkout', 'Enter an expired card', 'Submit'],
  expectedResult: 'The payment is refused with a clear message',
  priority: 'high' as const,
};

const assistantRow = {
  id: 'message-2',
  threadId: 'thread-1',
  role: 'assistant' as const,
  content: 'Here is a case worth adding.',
  suggestedCases: [suggestedCase],
  promptVersion: CHAT_PROMPT_VERSION,
  totalTokens: 120,
  createdAt: new Date('2026-09-05T10:05:00.000Z'),
};

const userRow = {
  id: 'message-1',
  threadId: 'thread-1',
  role: 'user' as const,
  content: 'What is missing in checkout?',
  suggestedCases: null,
  promptVersion: null,
  totalTokens: null,
  createdAt: new Date('2026-09-05T10:04:00.000Z'),
};

interface FakePrisma {
  project: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  chatThread: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  chatMessage: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  suite: { findMany: jest.Mock; findFirst: jest.Mock };
  testCase: { findMany: jest.Mock };
  run: { findMany: jest.Mock };
  evidence: { create: jest.Mock };
  extractedProposal: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'project-1', name: 'Shop' }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ locale: 'es' }) },
    chatThread: {
      findMany: jest.fn().mockResolvedValue([threadRow]),
      findFirst: jest.fn().mockResolvedValue(threadRow),
      create: jest.fn().mockResolvedValue(threadRow),
      update: jest.fn().mockResolvedValue(threadRow),
    },
    chatMessage: {
      findMany: jest.fn().mockResolvedValue([userRow, assistantRow]),
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(assistantRow)
        .mockResolvedValueOnce({ content: userRow.content }),
      create: jest
        .fn()
        .mockResolvedValueOnce(userRow)
        .mockResolvedValueOnce(assistantRow),
    },
    suite: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'suite-1', name: 'Checkout', _count: { cases: 4 } },
        ]),
      findFirst: jest.fn().mockResolvedValue({ id: 'suite-1' }),
    },
    testCase: {
      findMany: jest.fn().mockResolvedValue([{ name: 'Accepts a valid card' }]),
    },
    run: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { name: 'CI #12', status: 'pass', startedAt: new Date() },
        ]),
    },
    evidence: { create: jest.fn().mockResolvedValue({ id: 'evidence-9' }) },
    extractedProposal: {
      create: jest.fn().mockResolvedValue({ id: 'proposal-9' }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: FakePrisma) => Promise<unknown>) => fn(prisma),
  );
  return prisma;
}

function createAssistant(
  outcome: ChatReplyOutcome,
): ChatAssistant & { reply: jest.Mock } {
  return { reply: jest.fn().mockResolvedValue(outcome) };
}

function containing(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape);
}

function fakeEntitlement(
  spendCredit: jest.Mock = jest.fn().mockResolvedValue(true),
): AiEntitlementService {
  return {
    isEntitled: jest.fn().mockResolvedValue(true),
    spendCredit,
  } as unknown as AiEntitlementService;
}

function build(
  prisma: FakePrisma,
  assistant: ChatAssistant,
  entitlement: AiEntitlementService = fakeEntitlement(),
): ChatService {
  return new ChatService(prisma as never, assistant, entitlement);
}

describe('ChatService', () => {
  it('lists the threads of the current user in the project, newest first', async () => {
    const prisma = createPrisma();
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    const result = await service.listThreads(org, user, 'project-1');

    expect(result).toEqual({
      ok: true,
      value: [containing({ id: 'thread-1', title: 'Checkout gaps' })],
    });
    expect(prisma.chatThread.findMany).toHaveBeenCalledWith(
      containing({
        where: { projectId: 'project-1', userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('rejects a project outside the organization', async () => {
    const prisma = createPrisma();
    prisma.project.findFirst.mockResolvedValue(null);
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    await expect(service.listThreads(org, user, 'project-9')).resolves.toEqual({
      ok: false,
      error: 'project-not-found',
    });
  });

  it('sends a message, stores both turns and returns the assistant reply with cases', async () => {
    const prisma = createPrisma();
    const assistant = createAssistant({
      kind: 'replied',
      reply: 'Here is a case worth adding.',
      cases: [suggestedCase],
      usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
    });
    const service = build(prisma, assistant);

    const result = await service.sendMessage(
      org,
      user,
      'project-1',
      'thread-1',
      {
        content: 'What is missing in checkout?',
      },
    );

    expect(result).toEqual({
      ok: true,
      value: containing({
        role: 'assistant',
        content: 'Here is a case worth adding.',
        suggestedCases: [suggestedCase],
      }),
    });
    expect(assistant.reply).toHaveBeenCalledWith(
      containing({
        locale: 'es',
        message: 'What is missing in checkout?',
        context: containing({ projectName: 'Shop' }),
      }),
    );
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(2);
    expect(prisma.chatMessage.create).toHaveBeenLastCalledWith(
      containing({
        data: containing({
          role: 'assistant',
          promptVersion: CHAT_PROMPT_VERSION,
          totalTokens: 120,
        }),
      }),
    );
  });

  it('falls back to the default locale when the user has no locale on record', async () => {
    const prisma = createPrisma();
    prisma.user.findUnique.mockResolvedValue({ locale: null });
    const assistant = createAssistant({
      kind: 'replied',
      reply: 'Here is a case worth adding.',
      cases: [],
      usage: { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
    });
    const service = build(prisma, assistant);

    await service.sendMessage(org, user, 'project-1', 'thread-1', {
      content: 'What is missing in checkout?',
    });

    expect(assistant.reply).toHaveBeenCalledWith(
      containing({ locale: DEFAULT_LOCALE }),
    );
  });

  it('keeps the user message and reports the provider as unavailable', async () => {
    const prisma = createPrisma();
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'no-key' }),
    );

    const result = await service.sendMessage(
      org,
      user,
      'project-1',
      'thread-1',
      {
        content: 'Hello',
      },
    );

    expect(result).toEqual({ ok: false, error: 'provider-unavailable' });
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
  });

  it('turns a suggested case into a proposal under review with the chat as evidence', async () => {
    const prisma = createPrisma();
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    const result = await service.sendToReview(
      org,
      user,
      'project-1',
      'thread-1',
      'message-2',
      {
        caseIndex: 0,
      },
    );

    expect(result).toEqual({ ok: true, value: { proposalId: 'proposal-9' } });
    expect(prisma.evidence.create).toHaveBeenCalledWith(
      containing({
        data: containing({
          kind: 'ARTIFACT',
          uri: 'qably://chat/thread-1/message-2/0',
          excerpt: 'What is missing in checkout?',
        }),
      }),
    );
    expect(prisma.extractedProposal.create).toHaveBeenCalledWith(
      containing({
        data: containing({
          status: 'in_review',
          title: suggestedCase.title,
          suiteId: 'suite-1',
          promptVersion: CHAT_PROMPT_VERSION,
        }),
      }),
    );
  });

  it('returns the existing proposal and creates nothing on a second send for the same case', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findFirst.mockResolvedValue({
      id: 'already-sent-proposal',
    });
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    const result = await service.sendToReview(
      org,
      user,
      'project-1',
      'thread-1',
      'message-2',
      { caseIndex: 0 },
    );

    expect(result).toEqual({
      ok: true,
      value: { proposalId: 'already-sent-proposal', alreadySent: true },
    });
    expect(prisma.extractedProposal.findFirst).toHaveBeenCalledWith(
      containing({
        where: {
          projectId: 'project-1',
          evidence: { uri: 'qably://chat/thread-1/message-2/0' },
        },
      }),
    );
    expect(prisma.evidence.create).not.toHaveBeenCalled();
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('rejects a case index the assistant never suggested', async () => {
    const prisma = createPrisma();
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    await expect(
      service.sendToReview(org, user, 'project-1', 'thread-1', 'message-2', {
        caseIndex: 4,
      }),
    ).resolves.toEqual({ ok: false, error: 'case-not-found' });
  });

  it('fails when the project has no suite to receive the proposal', async () => {
    const prisma = createPrisma();
    prisma.suite.findFirst.mockResolvedValue(null);
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    await expect(
      service.sendToReview(org, user, 'project-1', 'thread-1', 'message-2', {
        caseIndex: 0,
      }),
    ).resolves.toEqual({ ok: false, error: 'missing-suite' });
  });

  it('spends one AI credit after a successful assistant reply', async () => {
    const prisma = createPrisma();
    const spendCredit = jest.fn().mockResolvedValue(true);
    const assistant = createAssistant({
      kind: 'replied',
      reply: 'Here is a case worth adding.',
      cases: [suggestedCase],
      usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
    });
    const service = build(prisma, assistant, fakeEntitlement(spendCredit));

    await service.sendMessage(org, user, 'project-1', 'thread-1', {
      content: 'What is missing in checkout?',
    });

    expect(spendCredit).toHaveBeenCalledWith('org-1', prisma);
  });

  it('does not spend a credit when the provider is unavailable', async () => {
    const prisma = createPrisma();
    const spendCredit = jest.fn().mockResolvedValue(true);
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'no-key' }),
      fakeEntitlement(spendCredit),
    );

    await service.sendMessage(org, user, 'project-1', 'thread-1', {
      content: 'Hello',
    });

    expect(spendCredit).not.toHaveBeenCalled();
  });

  it('reports ai-not-enabled and keeps the user message when the credit decrement fails', async () => {
    const prisma = createPrisma();
    const spendCredit = jest.fn().mockResolvedValue(false);
    const assistant = createAssistant({
      kind: 'replied',
      reply: 'Here is a case worth adding.',
      cases: [suggestedCase],
      usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
    });
    const service = build(prisma, assistant, fakeEntitlement(spendCredit));

    const result = await service.sendMessage(
      org,
      user,
      'project-1',
      'thread-1',
      { content: 'What is missing in checkout?' },
    );

    expect(result).toEqual({ ok: false, error: 'ai-not-enabled' });
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
  });

  it('spends the credit inside the persisting transaction so a persist failure would roll the credit back too', async () => {
    const prisma = createPrisma();
    prisma.chatMessage.create
      .mockReset()
      .mockResolvedValueOnce(userRow)
      .mockRejectedValueOnce(new Error('db unavailable'));
    const spendCredit = jest.fn().mockResolvedValue(true);
    const assistant = createAssistant({
      kind: 'replied',
      reply: 'Here is a case worth adding.',
      cases: [suggestedCase],
      usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
    });
    const service = build(prisma, assistant, fakeEntitlement(spendCredit));

    await expect(
      service.sendMessage(org, user, 'project-1', 'thread-1', {
        content: 'What is missing in checkout?',
      }),
    ).rejects.toThrow('db unavailable');

    expect(spendCredit).toHaveBeenCalledWith('org-1', prisma);
    expect(prisma.chatThread.update).not.toHaveBeenCalled();
  });

  it('sets a real title after a first attempt that failed before any assistant reply was ever persisted', async () => {
    const prisma = createPrisma();
    const failedAttemptUserRow = {
      ...userRow,
      id: 'message-failed',
    };
    const retryUserRow = { ...userRow, id: 'message-retry' };

    prisma.chatMessage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([failedAttemptUserRow]);
    prisma.chatMessage.create
      .mockReset()
      .mockResolvedValueOnce(failedAttemptUserRow)
      .mockResolvedValueOnce(retryUserRow)
      .mockResolvedValueOnce(assistantRow);

    const failingService = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'no-key' }),
    );
    await failingService.sendMessage(org, user, 'project-1', 'thread-1', {
      content: 'What is missing in checkout?',
    });

    expect(prisma.chatThread.update).not.toHaveBeenCalled();

    const service = build(
      prisma,
      createAssistant({
        kind: 'replied',
        reply: 'Here is a case worth adding.',
        cases: [suggestedCase],
        usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
      }),
    );
    await service.sendMessage(org, user, 'project-1', 'thread-1', {
      content: 'What is missing in checkout?',
    });

    expect(prisma.chatThread.update).toHaveBeenCalledWith(
      containing({
        data: containing({ title: 'What is missing in checkout?' }),
      }),
    );
  });

  it('exposes an empty suggestedCases array and logs a warning when the stored JSON is corrupt', async () => {
    const prisma = createPrisma();
    prisma.chatMessage.findMany.mockResolvedValue([
      { ...assistantRow, suggestedCases: 'not-an-array' },
    ]);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    const result = await service.getThread(org, user, 'project-1', 'thread-1');

    expect(result).toEqual({
      ok: true,
      value: containing({
        messages: [containing({ suggestedCases: [] })],
      }),
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('fails closed with invalid-suggested-cases instead of case-not-found when the stored JSON is corrupt', async () => {
    const prisma = createPrisma();
    prisma.chatMessage.findFirst.mockReset();
    prisma.chatMessage.findFirst.mockResolvedValueOnce({
      ...assistantRow,
      suggestedCases: 'not-an-array',
    });
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    const result = await service.sendToReview(
      org,
      user,
      'project-1',
      'thread-1',
      'message-2',
      { caseIndex: 0 },
    );

    expect(result).toEqual({ ok: false, error: 'invalid-suggested-cases' });
    expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
  });

  it('maps existing evidence uris back onto the thread messages as sentProposalIds', async () => {
    const prisma = createPrisma();
    prisma.extractedProposal.findMany.mockResolvedValue([
      {
        id: 'proposal-1',
        evidence: { uri: 'qably://chat/thread-1/message-2/0' },
      },
    ]);
    const service = build(
      prisma,
      createAssistant({ kind: 'provider-unavailable', reason: 'x' }),
    );

    const result = await service.getThread(org, user, 'project-1', 'thread-1');

    expect(prisma.extractedProposal.findMany).toHaveBeenCalledWith(
      containing({
        where: {
          projectId: 'project-1',
          evidence: { uri: { startsWith: 'qably://chat/thread-1/' } },
        },
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: containing({
        messages: [
          containing({ id: 'message-1' }),
          containing({
            id: 'message-2',
            sentProposalIds: { 0: 'proposal-1' },
          }),
        ],
      }),
    });
  });
});
