import { Inject, Injectable, Logger } from '@nestjs/common';
import { resolveLocale } from '@qably/i18n';
import {
  assessCaseDocumentation,
  type RepoConnectionProvider,
} from '@qably/types';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import { buildBlobUrl } from '../repository/source-reader';
import { gate } from './chat-evidence-gate';
import {
  CaseContextBuilder,
  type CaseContextCandidate,
  type CaseContextConnection,
  type EvidenceCandidate,
  type ExcerptOutcome,
} from './case-context-builder';
import type { ChatProjectContext } from './chat-prompt';
import type { ChatAssistant, ChatHistoryEntry } from './chat.assistant';
import {
  CHAT_ASSISTANT,
  CHAT_PROMPT_VERSION,
  MAX_EXCERPT_LENGTH,
  MAX_HISTORY_MESSAGES,
  suggestedCasesSchema,
  type AttachedCaseView,
  type ChatError,
  type ChatMessageView,
  type ChatRole,
  type ChatThreadDetailView,
  type ChatThreadView,
  type SendToReviewView,
  type SuggestedCase,
} from './chat.contracts';
import {
  MAX_ATTACHED_CASES,
  type CreateThreadInput,
  type SendMessageInput,
  type SendToReviewInput,
} from './chat.schemas';

const DEFAULT_THREAD_TITLE = 'New conversation';
const CONTEXT_CASE_LIMIT = 60;
const CONTEXT_RUN_LIMIT = 5;
const THREAD_LIST_LIMIT = 50;
const UNIQUE_VIOLATION = 'P2002';
const HUMAN_DOCUMENTATION_SOURCE = 'human';
const NOT_BYOK = { isByok: false };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

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
  attachedCaseIds?: string[];
  createdAt: Date;
}

interface AttachedCaseRow {
  id: string;
  name: string;
  suite: { name: string };
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  documentationSource: string;
  automationKey: string | null;
  automationFilePath: string | null;
}

function toCaseContextCandidate(row: AttachedCaseRow): CaseContextCandidate {
  const assessment = assessCaseDocumentation({
    name: row.name,
    automationKey: row.automationKey,
    objective: row.objective,
    steps: row.steps,
    expectedResult: row.expectedResult,
  });

  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    preconditions: row.preconditions,
    steps: row.steps,
    expectedResult: row.expectedResult,
    documentationSource: row.documentationSource,
    missing: assessment.missing,
    automationKey: row.automationKey,
    automationFilePath: row.automationFilePath,
  };
}

function stripUnattachedTarget(
  suggested: SuggestedCase,
  attachedIds: ReadonlySet<string>,
): SuggestedCase {
  if (
    suggested.targetTestCaseId === undefined ||
    attachedIds.has(suggested.targetTestCaseId)
  ) {
    return suggested;
  }

  return { ...suggested, targetTestCaseId: undefined };
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
  attachedCasesById?: ReadonlyMap<string, AttachedCaseView>,
): ChatMessageView {
  const read = readSuggestedCases(row.suggestedCases);

  if (read.kind === 'corrupt') {
    logger.warn(`Corrupt suggestedCases JSON on chat message ${row.id}`);
  }

  const attachedCases = (row.attachedCaseIds ?? []).flatMap((id) => {
    const attachedCase = attachedCasesById?.get(id);
    return attachedCase === undefined ? [] : [attachedCase];
  });

  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role,
    content: row.content,
    suggestedCases: read.kind === 'ok' ? read.cases : [],
    attachedCases,
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

function targetedChatCaseKey(
  messageId: string,
  targetTestCaseId: string,
): string {
  return `${messageId}:${targetTestCaseId}`;
}

function lineAnchor(
  provider: RepoConnectionProvider,
  startLine: number,
  endLine: number,
): string {
  return provider === 'GITHUB'
    ? `#L${startLine}-L${endLine}`
    : `#lines-${startLine}:${endLine}`;
}

interface TargetedEvidence {
  uri: string;
  excerpt: string;
}

type TargetedEvidenceResult =
  | { kind: 'ok'; evidence: TargetedEvidence }
  | { kind: 'no-code-evidence'; reason: string };

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
    private readonly caseContextBuilder: CaseContextBuilder,
    private readonly dailyBudget: AiDailyBudget,
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

    const messages = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    const [sentProposalIdsByMessage, attachedCasesById] = await Promise.all([
      this.loadSentProposalIds(projectId, threadId),
      this.loadAttachedCases(
        messages.flatMap((row) => row.attachedCaseIds ?? []),
      ),
    ]);

    return ok({
      ...toThreadView(thread),
      messages: messages.map((row) =>
        toMessageView(
          row,
          sentProposalIdsByMessage.get(row.id),
          attachedCasesById,
        ),
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

    const caseIds = input.caseIds ?? [];
    if (caseIds.length > MAX_ATTACHED_CASES) return err('too-many-cases');

    let attachedRows: AttachedCaseRow[] = [];
    if (caseIds.length > 0) {
      attachedRows = await this.findCasesInProject(projectId, caseIds);
      if (attachedRows.length !== caseIds.length) return err('case-not-found');
    }

    const history = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
    });
    const threadNeedsTitle = !history.some(
      (message) => message.role === 'assistant',
    );

    await this.prisma.chatMessage.create({
      data: {
        threadId,
        role: 'user',
        content: input.content,
        attachedCaseIds: caseIds,
      },
    });

    const withinBudget = await this.dailyBudget.tryConsume(NOT_BYOK);
    if (!withinBudget) return err('quota-exhausted');

    const [context, locale, connection] = await Promise.all([
      this.buildContext(projectId),
      this.resolveLocale(user.id),
      caseIds.length > 0 ? this.findConnection(projectId) : null,
    ]);
    const caseContext =
      caseIds.length > 0
        ? await this.caseContextBuilder.build(
            attachedRows.map(toCaseContextCandidate),
            connection,
          )
        : undefined;
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
      caseContext,
    });

    if (outcome.kind === 'provider-unavailable') {
      return err('provider-unavailable');
    }

    const attachedIdSet = new Set(caseIds);
    const filteredCases = outcome.cases.map((suggested) =>
      stripUnattachedTarget(suggested, attachedIdSet),
    );

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
            suggestedCases: filteredCases,
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

    if (suggested.targetTestCaseId !== undefined) {
      return this.sendTargetedToReview(
        projectId,
        thread,
        messageId,
        suggested,
        suggested.targetTestCaseId,
      );
    }

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

  private async sendTargetedToReview(
    projectId: string,
    thread: ThreadRow,
    messageId: string,
    suggested: SuggestedCase,
    targetTestCaseId: string,
  ): Promise<Result<SendToReviewView, ChatError>> {
    const chatCaseKey = targetedChatCaseKey(messageId, targetTestCaseId);

    const existingProposal = await this.prisma.extractedProposal.findFirst({
      where: { projectId, chatCaseKey },
      select: { id: true },
    });
    if (existingProposal !== null) {
      return ok({ proposalId: existingProposal.id, alreadySent: true });
    }

    const target = await this.prisma.testCase.findFirst({
      where: { id: targetTestCaseId, projectId },
      select: {
        suiteId: true,
        automationKey: true,
        automationFilePath: true,
        documentationSource: true,
      },
    });
    if (target === null) return err('case-not-found');
    if (target.documentationSource === HUMAN_DOCUMENTATION_SOURCE) {
      return err('human-documented');
    }

    const connection = await this.findConnection(projectId);
    const evidenceResult = await this.buildTargetedEvidence(target, connection);
    if (evidenceResult.kind === 'no-code-evidence') {
      return err('no-code-evidence');
    }
    const evidence = evidenceResult.evidence;

    try {
      const proposal = await this.prisma.$transaction(async (tx: TxClient) => {
        const evidenceRow = await tx.evidence.create({
          data: {
            projectId,
            kind: 'SOURCE_EXCERPT',
            title: `Chat: ${thread.title}`,
            uri: evidence.uri,
            excerpt: evidence.excerpt,
          },
          select: { id: true },
        });

        return tx.extractedProposal.create({
          data: {
            projectId,
            evidenceId: evidenceRow.id,
            suiteId: target.suiteId,
            targetTestCaseId,
            automationKey: target.automationKey,
            chatCaseKey,
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
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const winner = await this.prisma.extractedProposal.findFirst({
        where: { projectId, chatCaseKey },
        select: { id: true },
      });
      if (winner === null) throw error;

      return ok({ proposalId: winner.id, alreadySent: true });
    }
  }

  private async buildTargetedEvidence(
    target: EvidenceCandidate,
    connection: CaseContextConnection | null,
  ): Promise<TargetedEvidenceResult> {
    if (connection === null || target.automationFilePath === null) {
      const gated = gate(null);
      return gated.kind === 'no-code-evidence'
        ? gated
        : { kind: 'no-code-evidence', reason: 'no-evidence' };
    }

    const { ref, excerpt } = await this.caseContextBuilder.locateForEvidence(
      target,
      connection,
    );
    const blobUrl = buildBlobUrl(
      connection.provider,
      connection.repo,
      ref,
      target.automationFilePath,
    );

    return this.toTargetedEvidence(connection.provider, blobUrl, excerpt);
  }

  private toTargetedEvidence(
    provider: RepoConnectionProvider,
    blobUrl: string,
    excerpt: ExcerptOutcome,
  ): TargetedEvidenceResult {
    const gated = gate(excerpt);
    if (gated.kind === 'no-code-evidence') {
      return gated;
    }

    if (excerpt.kind === 'declaration') {
      return {
        kind: 'ok',
        evidence: {
          uri: `${blobUrl}${lineAnchor(provider, excerpt.startLine, excerpt.endLine)}`,
          excerpt: gated.excerpt,
        },
      };
    }
    return { kind: 'ok', evidence: { uri: blobUrl, excerpt: gated.excerpt } };
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

  private async findCasesInProject(
    projectId: string,
    caseIds: readonly string[],
  ): Promise<AttachedCaseRow[]> {
    return this.prisma.testCase.findMany({
      where: { id: { in: [...caseIds] }, projectId },
      select: {
        id: true,
        name: true,
        suite: { select: { name: true } },
        objective: true,
        preconditions: true,
        steps: true,
        expectedResult: true,
        documentationSource: true,
        automationKey: true,
        automationFilePath: true,
      },
    });
  }

  private async findConnection(
    projectId: string,
  ): Promise<CaseContextConnection | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      select: {
        connection: {
          select: { provider: true, repo: true, encryptedAccessToken: true },
        },
      },
    });

    return project?.connection ?? null;
  }

  private async loadAttachedCases(
    caseIds: readonly string[],
  ): Promise<Map<string, AttachedCaseView>> {
    const uniqueIds = [...new Set(caseIds)];
    if (uniqueIds.length === 0) return new Map();

    const rows = (await this.prisma.testCase.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, suite: { select: { name: true } } },
    })) as Pick<AttachedCaseRow, 'id' | 'name' | 'suite'>[];

    return new Map(
      rows.map((row) => [
        row.id,
        { id: row.id, name: row.name, suiteName: row.suite.name },
      ]),
    );
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
