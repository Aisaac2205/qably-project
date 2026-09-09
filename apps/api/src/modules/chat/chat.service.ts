import { Inject, Injectable, Logger } from '@nestjs/common';
import { resolveLocale } from '@qably/i18n';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { ChatProjectContext } from './chat-prompt';
import type { ChatAssistant, ChatHistoryEntry } from './chat.assistant';
import {
  CHAT_ASSISTANT,
  CHAT_PROMPT_VERSION,
  MAX_EXCERPT_LENGTH,
  MAX_HISTORY_MESSAGES,
  suggestedCasesSchema,
  type ChatError,
  type ChatMessageView,
  type ChatRole,
  type ChatThreadDetailView,
  type ChatThreadView,
  type SendToReviewView,
  type SuggestedCase,
} from './chat.contracts';
import type {
  CreateThreadInput,
  SendMessageInput,
  SendToReviewInput,
} from './chat.schemas';

const DEFAULT_THREAD_TITLE = 'New conversation';
const CONTEXT_CASE_LIMIT = 60;
const CONTEXT_RUN_LIMIT = 5;
const THREAD_LIST_LIMIT = 50;

const logger = new Logger('ChatService');

interface ThreadRow {
  id: string;
  projectId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  threadId: string;
  role: ChatRole;
  content: string;
  suggestedCases: unknown;
  createdAt: Date;
}

type TxClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

type SuggestedCasesRead =
  | { kind: 'absent' }
  | { kind: 'ok'; cases: SuggestedCase[] }
  | { kind: 'corrupt' };

function readSuggestedCases(value: unknown): SuggestedCasesRead {
  if (value === null || value === undefined) return { kind: 'absent' };

  const parsed = suggestedCasesSchema.safeParse(value);
  return parsed.success
    ? { kind: 'ok', cases: parsed.data }
    : { kind: 'corrupt' };
}

function toThreadView(row: ThreadRow): ChatThreadView {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageView(
  row: MessageRow,
  sentProposalIds?: Record<number, string>,
): ChatMessageView {
  const read = readSuggestedCases(row.suggestedCases);

  if (read.kind === 'corrupt') {
    logger.warn(`Corrupt suggestedCases JSON on chat message ${row.id}`);
  }

  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role,
    content: row.content,
    suggestedCases: read.kind === 'ok' ? read.cases : [],
    createdAt: row.createdAt.toISOString(),
    ...(sentProposalIds !== undefined ? { sentProposalIds } : {}),
  };
}

function chatEvidenceUri(
  threadId: string,
  messageId: string,
  caseIndex: number,
): string {
  return `qably://chat/${threadId}/${messageId}/${caseIndex}`;
}

function parseChatEvidenceUri(
  prefix: string,
  uri: string,
): { messageId: string; caseIndex: number } | null {
  if (!uri.startsWith(prefix)) return null;

  const [messageId, caseIndexRaw] = uri.slice(prefix.length).split('/');
  const caseIndex = Number(caseIndexRaw);
  if (messageId === undefined || messageId === '' || Number.isNaN(caseIndex)) {
    return null;
  }

  return { messageId, caseIndex };
}

function threadTitleFrom(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  return firstLine.length === 0
    ? DEFAULT_THREAD_TITLE
    : firstLine.slice(0, 120);
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHAT_ASSISTANT) private readonly assistant: ChatAssistant,
    private readonly entitlement: AiEntitlementService,
  ) {}

  async listThreads(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<Result<ChatThreadView[], ChatError>> {
    const project = await this.findProject(org, projectId);
    if (project === null) return err('project-not-found');

    const rows = await this.prisma.chatThread.findMany({
      where: { projectId, userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: THREAD_LIST_LIMIT,
    });

    return ok(rows.map(toThreadView));
  }

  async createThread(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    input: CreateThreadInput,
  ): Promise<Result<ChatThreadView, ChatError>> {
    const project = await this.findProject(org, projectId);
    if (project === null) return err('project-not-found');

    const row = await this.prisma.chatThread.create({
      data: {
        projectId,
        organizationId: org.organizationId,
        userId: user.id,
        title: input.title ?? DEFAULT_THREAD_TITLE,
      },
    });

    return ok(toThreadView(row));
  }

  async getThread(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
  ): Promise<Result<ChatThreadDetailView, ChatError>> {
    const thread = await this.findThread(org, user, projectId, threadId);
    if (thread === null) return err('thread-not-found');

    const [messages, sentProposalIdsByMessage] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
      }),
      this.loadSentProposalIds(projectId, threadId),
    ]);

    return ok({
      ...toThreadView(thread),
      messages: messages.map((row) =>
        toMessageView(row, sentProposalIdsByMessage.get(row.id)),
      ),
    });
  }

  async deleteThread(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
  ): Promise<Result<void, ChatError>> {
    const thread = await this.findThread(org, user, projectId, threadId);
    if (thread === null) return err('thread-not-found');

    await this.prisma.chatThread.delete({ where: { id: threadId } });

    return ok(undefined);
  }

  async sendMessage(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
    input: SendMessageInput,
  ): Promise<Result<ChatMessageView, ChatError>> {
    const thread = await this.findThread(org, user, projectId, threadId);
    if (thread === null) return err('thread-not-found');

    const history = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
    });
    const threadNeedsTitle = !history.some(
      (message) => message.role === 'assistant',
    );

    await this.prisma.chatMessage.create({
      data: { threadId, role: 'user', content: input.content },
    });

    const [context, locale] = await Promise.all([
      this.buildContext(projectId),
      this.resolveLocale(user.id),
    ]);
    const outcome = await this.assistant.reply({
      locale,
      message: input.content,
      history: history
        .slice()
        .reverse()
        .map(
          (row): ChatHistoryEntry => ({ role: row.role, content: row.content }),
        ),
      context,
    });

    if (outcome.kind === 'provider-unavailable') {
      return err('provider-unavailable');
    }

    const assistantRow = await this.prisma.$transaction(
      async (tx: TxClient) => {
        const spent = await this.entitlement.spendCredit(
          org.organizationId,
          tx,
        );
        if (!spent) return null;

        const created = await tx.chatMessage.create({
          data: {
            threadId,
            role: 'assistant',
            content: outcome.reply,
            suggestedCases: outcome.cases,
            promptVersion: CHAT_PROMPT_VERSION,
            totalTokens: outcome.usage.totalTokens,
          },
        });
        await tx.chatThread.update({
          where: { id: threadId },
          data: threadNeedsTitle
            ? { title: threadTitleFrom(input.content), updatedAt: new Date() }
            : { updatedAt: new Date() },
        });
        return created;
      },
    );

    if (assistantRow === null) return err('ai-not-enabled');

    return ok(toMessageView(assistantRow));
  }

  async sendToReview(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
    messageId: string,
    input: SendToReviewInput,
  ): Promise<Result<SendToReviewView, ChatError>> {
    const thread = await this.findThread(org, user, projectId, threadId);
    if (thread === null) return err('thread-not-found');

    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, threadId, role: 'assistant' },
    });
    if (message === null) return err('message-not-found');

    const read = readSuggestedCases(message.suggestedCases);
    if (read.kind === 'corrupt') return err('invalid-suggested-cases');

    const suggested =
      read.kind === 'ok' ? read.cases[input.caseIndex] : undefined;
    if (suggested === undefined) return err('case-not-found');

    const evidenceUri = chatEvidenceUri(threadId, messageId, input.caseIndex);

    const existingProposal = await this.prisma.extractedProposal.findFirst({
      where: { projectId, evidence: { uri: evidenceUri } },
      select: { id: true },
    });
    if (existingProposal !== null) {
      return ok({ proposalId: existingProposal.id, alreadySent: true });
    }

    const suite = await this.prisma.suite.findFirst({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (suite === null) return err('missing-suite');

    const prompt = await this.prisma.chatMessage.findFirst({
      where: { threadId, role: 'user', createdAt: { lt: message.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    });

    const proposal = await this.prisma.$transaction(async (tx: TxClient) => {
      const evidence = await tx.evidence.create({
        data: {
          projectId,
          kind: 'ARTIFACT',
          title: `Chat: ${thread.title}`,
          uri: evidenceUri,
          excerpt: (prompt?.content ?? message.content).slice(
            0,
            MAX_EXCERPT_LENGTH,
          ),
        },
        select: { id: true },
      });

      return tx.extractedProposal.create({
        data: {
          projectId,
          evidenceId: evidence.id,
          suiteId: suite.id,
          status: 'in_review',
          title: suggested.title,
          objective: suggested.objective,
          preconditions: suggested.preconditions,
          steps: suggested.steps,
          expectedResult: suggested.expectedResult,
          priority: suggested.priority,
          promptVersion: CHAT_PROMPT_VERSION,
        },
        select: { id: true },
      });
    });

    return ok({ proposalId: proposal.id });
  }

  private async loadSentProposalIds(
    projectId: string,
    threadId: string,
  ): Promise<Map<string, Record<number, string>>> {
    const prefix = `qably://chat/${threadId}/`;
    const proposals = await this.prisma.extractedProposal.findMany({
      where: { projectId, evidence: { uri: { startsWith: prefix } } },
      select: { id: true, evidence: { select: { uri: true } } },
    });

    const map = new Map<string, Record<number, string>>();
    for (const proposal of proposals) {
      const parsed = parseChatEvidenceUri(prefix, proposal.evidence.uri);
      if (parsed === null) continue;

      const existing = map.get(parsed.messageId) ?? {};
      existing[parsed.caseIndex] = proposal.id;
      map.set(parsed.messageId, existing);
    }
    return map;
  }

  private findProject(
    org: OrgContext,
    projectId: string,
  ): Promise<{ id: string; name: string } | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId: org.organizationId },
      select: { id: true, name: true },
    });
  }

  private async findThread(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
  ): Promise<ThreadRow | null> {
    const project = await this.findProject(org, projectId);
    if (project === null) return null;

    return this.prisma.chatThread.findFirst({
      where: { id: threadId, projectId, userId: user.id },
    });
  }

  private async resolveLocale(userId: string): Promise<'es' | 'en'> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return resolveLocale(row?.locale);
  }

  private async buildContext(projectId: string): Promise<ChatProjectContext> {
    const [project, suites, cases, runs] = await Promise.all([
      this.prisma.project.findFirst({
        where: { id: projectId },
        select: { name: true },
      }),
      this.prisma.suite.findMany({
        where: { projectId },
        select: { id: true, name: true, _count: { select: { cases: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.testCase.findMany({
        where: { projectId, state: 'active' },
        select: { name: true },
        orderBy: { updatedAt: 'desc' },
        take: CONTEXT_CASE_LIMIT,
      }),
      this.prisma.run.findMany({
        where: { projectId },
        select: { name: true, status: true, startedAt: true },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: CONTEXT_RUN_LIMIT,
      }),
    ]);

    return {
      projectName: project?.name ?? projectId,
      suites: suites.map((suite) => ({
        name: suite.name,
        cases: suite._count.cases,
      })),
      caseTitles: cases.map((testCase) => testCase.name),
      recentRuns: runs.map((run) => ({ name: run.name, status: run.status })),
    };
  }
}
