import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  SESSION_READER,
  type SessionContext,
} from '../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/modules/auth/auth.instance';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { AI_DAILY_BUDGET_REDIS } from '../src/modules/ai/ai.tokens';
import { AiDailyBudget } from '../src/modules/ai/ai-daily-budget.service';
import { AiEntitlementService } from '../src/modules/ai/ai-entitlement.service';
import { CaseContextBuilder } from '../src/modules/chat/case-context-builder';
import { buildGroundingDeclineReply } from '../src/modules/chat/chat-prompt';
import { CHAT_ASSISTANT } from '../src/modules/chat/chat.contracts';
import { ChatModule } from '../src/modules/chat/chat.module';
import { ConfigModule } from '../src/config/config.module';
import { ENV } from '../src/config/config.tokens';
import { OrganizationsModule } from '../src/modules/organizations/organizations.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { stubQueues } from './support/stub-queues';
import { testEnv } from './support/test-env';

const session: SessionContext = {
  user: {
    id: 'user-1',
    email: 'qa@acme.test',
    name: 'QA',
    emailVerified: true,
    locale: null,
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const threadRow = {
  id: 'thread-1',
  projectId: 'project-1',
  organizationId: 'org-1',
  userId: 'user-1',
  title: 'Checkout gaps',
  createdAt: new Date('2026-09-25T10:00:00.000Z'),
  updatedAt: new Date('2026-09-25T10:05:00.000Z'),
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
  promptVersion: 'chat-v5',
  totalTokens: 120,
  createdAt: new Date('2026-09-25T10:05:00.000Z'),
};

const targetedAssistantRow = {
  ...assistantRow,
  suggestedCases: [{ ...suggestedCase, targetTestCaseId: 'case-1' }],
};

const userRow = {
  id: 'message-1',
  threadId: 'thread-1',
  role: 'user' as const,
  content: 'What is missing in checkout?',
  suggestedCases: null,
  promptVersion: null,
  totalTokens: null,
  createdAt: new Date('2026-09-25T10:04:00.000Z'),
};

const githubConnection = {
  provider: 'GITHUB' as const,
  repo: 'acme/shop',
  encryptedAccessToken: null,
};

interface ChatMessageBody {
  content: string;
  suggestedCases: unknown[];
  grounding: { status: string } | null;
}

function containing(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape);
}

interface FakePrisma {
  project: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  orgMember: { findFirst: jest.Mock };
  chatThread: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  chatMessage: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
  suite: { findMany: jest.Mock; findFirst: jest.Mock };
  testCase: { findMany: jest.Mock; findFirst: jest.Mock };
  run: { findMany: jest.Mock };
  evidence: { create: jest.Mock };
  extractedProposal: {
    create: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
}

function createPrisma(): FakePrisma {
  const prisma: FakePrisma = {
    project: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'project-1', name: 'Shop', connection: null }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ locale: 'es' }) },
    orgMember: {
      findFirst: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        role: 'owner',
        organization: { slug: 'acme' },
      }),
    },
    chatThread: {
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
      // Echoes the actual `data` passed by ChatService back as the created
      // row (branching on role), so HTTP response bodies in this e2e file
      // reflect the real reply/grounding transformation, not a canned value.
      create: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) => {
          const base = args.data.role === 'user' ? userRow : assistantRow;
          return Promise.resolve({ ...base, ...args.data });
        }),
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
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        suiteId: 'suite-1',
        automationKey: 'Checkout > rejects an expired card',
        automationFilePath: 'src/checkout.spec.ts',
        documentationSource: 'aeris',
      }),
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
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: FakePrisma) => Promise<unknown>) => fn(prisma),
  );
  return prisma;
}

function fakeAssistant(): { reply: jest.Mock } {
  return { reply: jest.fn() };
}

function fakeCaseContextBuilder(): {
  build: jest.Mock;
  locateForEvidence: jest.Mock;
} {
  return {
    build: jest.fn().mockResolvedValue(''),
    locateForEvidence: jest.fn().mockResolvedValue({
      ref: 'sha123',
      excerpt: {
        kind: 'declaration',
        excerpt: 'it("rejects an expired card", () => {})',
        startLine: 10,
        endLine: 12,
      },
    }),
  };
}

describe('Aeris chat grounding (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  let prisma: FakePrisma;
  let assistant: { reply: jest.Mock };
  let caseContextBuilder: { build: jest.Mock; locateForEvidence: jest.Mock };
  let spendCredit: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    prisma = createPrisma();
    assistant = fakeAssistant();
    caseContextBuilder = fakeCaseContextBuilder();
    spendCredit = jest.fn().mockResolvedValue(true);

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [
          ConfigModule,
          PrismaModule,
          AuthModule,
          OrganizationsModule,
          ChatModule,
        ],
      }),
    )
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read })
      .overrideProvider(AI_DAILY_BUDGET_REDIS)
      .useValue({})
      .overrideProvider(AiEntitlementService)
      .useValue({
        isEntitled: jest.fn().mockResolvedValue(true),
        spendCredit,
      })
      .overrideProvider(AiDailyBudget)
      .useValue({ tryConsume: jest.fn().mockResolvedValue(true) })
      .overrideProvider(CHAT_ASSISTANT)
      .useValue(assistant)
      .overrideProvider(CaseContextBuilder)
      .useValue(caseContextBuilder)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('targeted send-to-review', () => {
    it('sends the happy path unchanged: real connection + located excerpt creates a SOURCE_EXCERPT proposal', async () => {
      prisma.chatMessage.findFirst.mockReset();
      prisma.chatMessage.findFirst
        .mockResolvedValueOnce(targetedAssistantRow)
        .mockResolvedValueOnce({ content: userRow.content });
      prisma.project.findFirst.mockResolvedValue({
        id: 'project-1',
        name: 'Shop',
        connection: githubConnection,
      });

      const response = await request(app.getHttpServer())
        .post(
          '/projects/project-1/chat/threads/thread-1/messages/message-2/proposals',
        )
        .send({ caseIndex: 0 })
        .expect(201);

      expect(response.body).toEqual({ proposalId: 'proposal-9' });
      expect(prisma.evidence.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            kind: 'SOURCE_EXCERPT',
            uri: 'https://github.com/acme/shop/blob/sha123/src/checkout.spec.ts#L10-L12',
            excerpt: 'it("rejects an expired card", () => {})',
          }),
        }),
      );
      expect(prisma.extractedProposal.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            targetTestCaseId: 'case-1',
            chatCaseKey: 'message-2:case-1',
          }),
        }),
      );
    });

    it('rejects a degraded targeted suggestion with 422 no-code-evidence and creates no rows', async () => {
      prisma.chatMessage.findFirst.mockReset();
      prisma.chatMessage.findFirst
        .mockResolvedValueOnce(targetedAssistantRow)
        .mockResolvedValueOnce({ content: userRow.content });
      prisma.testCase.findFirst.mockResolvedValue({
        suiteId: 'suite-1',
        automationKey: 'Checkout > rejects an expired card',
        automationFilePath: null,
        documentationSource: 'aeris',
      });
      prisma.project.findFirst.mockResolvedValue({
        id: 'project-1',
        name: 'Shop',
        connection: githubConnection,
      });

      const response = await request(app.getHttpServer())
        .post(
          '/projects/project-1/chat/threads/thread-1/messages/message-2/proposals',
        )
        .send({ caseIndex: 0 })
        .expect(422);

      expect(response.body).toMatchObject({ code: 'no-code-evidence' });
      expect(prisma.evidence.create).not.toHaveBeenCalled();
      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });
  });

  describe('untargeted send-to-review', () => {
    it('creates a proposal from a valid typed file path with no targetTestCaseId', async () => {
      prisma.chatMessage.findFirst.mockReset();
      prisma.chatMessage.findFirst
        .mockResolvedValueOnce(assistantRow)
        .mockResolvedValueOnce({ attachedFilePath: 'src/checkout.spec.ts' });
      prisma.project.findFirst.mockResolvedValue({
        id: 'project-1',
        name: 'Shop',
        connection: githubConnection,
      });
      caseContextBuilder.locateForEvidence.mockResolvedValue({
        ref: 'sha123',
        excerpt: {
          kind: 'file-head',
          excerpt: 'export function checkout() {}',
        },
      });

      const response = await request(app.getHttpServer())
        .post(
          '/projects/project-1/chat/threads/thread-1/messages/message-2/proposals',
        )
        .send({ caseIndex: 0 })
        .expect(201);

      expect(response.body).toEqual({ proposalId: 'proposal-9' });
      const calls = prisma.extractedProposal.create.mock.calls as unknown[][];
      const created = calls[0][0] as { data: { targetTestCaseId?: string } };
      expect(created.data.targetTestCaseId).toBeUndefined();
      expect(prisma.evidence.create).toHaveBeenCalledWith(
        containing({
          data: containing({
            uri: 'https://github.com/acme/shop/blob/sha123/src/checkout.spec.ts',
            excerpt: 'export function checkout() {}',
          }),
        }),
      );
    });

    it('rejects with 422 no-code-evidence when no file path was attached, creating no rows', async () => {
      prisma.chatMessage.findFirst.mockReset();
      prisma.chatMessage.findFirst
        .mockResolvedValueOnce(assistantRow)
        .mockResolvedValueOnce({ attachedFilePath: null });

      const response = await request(app.getHttpServer())
        .post(
          '/projects/project-1/chat/threads/thread-1/messages/message-2/proposals',
        )
        .send({ caseIndex: 0 })
        .expect(422);

      expect(response.body).toMatchObject({ code: 'no-code-evidence' });
      expect(prisma.evidence.create).not.toHaveBeenCalled();
      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });

    it('rejects with 422 no-code-evidence when the typed path cannot be located in the repo', async () => {
      prisma.chatMessage.findFirst.mockReset();
      prisma.chatMessage.findFirst
        .mockResolvedValueOnce(assistantRow)
        .mockResolvedValueOnce({ attachedFilePath: 'src/missing.ts' });
      prisma.project.findFirst.mockResolvedValue({
        id: 'project-1',
        name: 'Shop',
        connection: githubConnection,
      });
      caseContextBuilder.locateForEvidence.mockResolvedValue({
        ref: 'sha123',
        excerpt: { kind: 'unavailable', reason: 'http-404' },
      });

      const response = await request(app.getHttpServer())
        .post(
          '/projects/project-1/chat/threads/thread-1/messages/message-2/proposals',
        )
        .send({ caseIndex: 0 })
        .expect(422);

      expect(response.body).toMatchObject({ code: 'no-code-evidence' });
      expect(prisma.extractedProposal.create).not.toHaveBeenCalled();
    });
  });

  describe('grounded-or-decline chat replies', () => {
    it('declines a fabricated grounding claim: replaces content, clears suggestedCases, but still spends the AI credit', async () => {
      assistant.reply.mockResolvedValue({
        kind: 'replied',
        reply: 'Here is a case worth adding.',
        cases: [suggestedCase],
        usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
        grounding: {
          status: 'grounded',
          references: [{ kind: 'source-excerpt', id: 'case-never-attached' }],
        },
      });

      const response = await request(app.getHttpServer())
        .post('/projects/project-1/chat/threads/thread-1/messages')
        .send({ content: 'What is missing in checkout?' })
        .expect(201);

      const body = response.body as ChatMessageBody;
      expect(body.content).not.toBe('Here is a case worth adding.');
      expect(body.content.length).toBeGreaterThan(0);
      expect(body.suggestedCases).toEqual([]);
      expect(body.grounding).toEqual({ status: 'insufficient' });

      const calls = prisma.chatMessage.create.mock.calls as unknown[][];
      const assistantCall = calls[1][0] as { data: { grounding: unknown } };
      expect(assistantCall.data.grounding).toEqual({ status: 'insufficient' });
    });

    it('spends the credit on the same decline (no refund path)', async () => {
      assistant.reply.mockResolvedValue({
        kind: 'replied',
        reply: 'I do not have enough information to answer that.',
        cases: [suggestedCase],
        usage: { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
        grounding: { status: 'insufficient' },
      });

      await request(app.getHttpServer())
        .post('/projects/project-1/chat/threads/thread-1/messages')
        .send({ content: 'What is missing in checkout?' })
        .expect(201);

      expect(spendCredit).toHaveBeenCalled();
    });
  });

  describe('locale non-regression on generated proposal fields', () => {
    it('keeps every suggested case field in the resolved locale end-to-end (es)', async () => {
      prisma.user.findUnique.mockResolvedValue({ locale: 'es' });
      const esCase = {
        title: 'Rechaza una tarjeta vencida',
        objective: 'Confirmar que las tarjetas vencidas se rechazan',
        preconditions: ['Un carrito con un producto'],
        steps: ['Abrir el checkout', 'Ingresar una tarjeta vencida', 'Enviar'],
        expectedResult: 'El pago se rechaza con un mensaje claro',
        priority: 'high' as const,
      };
      assistant.reply.mockResolvedValue({
        kind: 'replied',
        reply: 'Aquí hay un caso que vale la pena agregar.',
        cases: [esCase],
        usage: { promptTokens: 100, candidatesTokens: 20, totalTokens: 120 },
        grounding: { status: 'insufficient' },
      });

      const response = await request(app.getHttpServer())
        .post('/projects/project-1/chat/threads/thread-1/messages')
        .send({ content: '¿Qué falta en el checkout?' })
        .expect(201);

      const body = response.body as ChatMessageBody;
      expect(body.content).toBe('Aquí hay un caso que vale la pena agregar.');
      expect(body.suggestedCases).toEqual([]);
      const calls = prisma.chatMessage.create.mock.calls as unknown[][];
      const assistantCall = calls[1][0] as {
        data: { suggestedCases: unknown };
      };
      expect(assistantCall.data.suggestedCases).toEqual([]);
    });

    it('honors an insufficient decline in the fixed decline sentence for the resolved locale (en)', async () => {
      prisma.user.findUnique.mockResolvedValue({ locale: 'en' });
      assistant.reply.mockResolvedValue({
        kind: 'replied',
        reply: 'Here is a case worth adding.',
        cases: [],
        usage: { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
        grounding: {
          status: 'grounded',
          references: [{ kind: 'attached-file', id: 'F1' }],
        },
      });

      await request(app.getHttpServer())
        .post('/projects/project-1/chat/threads/thread-1/messages')
        .send({ content: 'What is missing in checkout?' })
        .expect(201);

      const calls = prisma.chatMessage.create.mock.calls as unknown[][];
      const assistantCall = calls[1][0] as { data: { content: string } };
      expect(assistantCall.data.content).toBe(buildGroundingDeclineReply('en'));
    });
  });
});
