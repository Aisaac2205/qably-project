import { Inject, Injectable, Logger } from '@nestjs/common';
import { resolveLocale } from '@qably/i18n';
import {
  assessCaseDocumentation,
  type GroundingView,
  type RepoConnectionProvider,
} from '@qably/types';
import { err, isErr, ok, type Result } from '../../common/result';
import { Prisma } from '../../../generated/prisma/client';
import { DOMAIN_EVENTS } from '../../common/events/domain-events';
import { DomainEvents } from '../../common/events/domain-events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import { buildBlobUrl } from '../repository/source-reader';
import { splitRepo } from '../repository/lib/split-repo';
import { readSuiteCaseCounts } from '../suites/lib/suite-case-counts';
import {
  classifyProposal,
  type ClassifyProposalCandidate,
  type ProposalClassification,
} from '../review/lib/classify-proposal';
import {
  buildGroundingManifest,
  groundingDeclarationSchema,
  resolveGrounding,
} from './chat-grounding';
import { gate } from './chat-evidence-gate';
import { indexSuiteFiles, type SuiteFileRow } from './chat-suite-files';
import {
  CaseContextBuilder,
  type AttachedFileContext,
  type CaseContextCandidate,
  type CaseContextConnection,
  type EvidenceCandidate,
  type ExcerptOutcome,
} from './case-context-builder';
import {
  buildGroundingDeclineReply,
  type ChatProjectContext,
} from './chat-prompt';
import type {
  ChatAssistant,
  ChatHistoryEntry,
  ChatReplyInput,
  ChatReplyOutcome,
} from './chat.assistant';
import {
  CHAT_ASSISTANT,
  CHAT_PROMPT_VERSION,
  MAX_HISTORY_MESSAGES,
  MAX_SUGGESTED_CASES,
  suggestedCasesSchema,
  type AttachedCaseView,
  type ChatError,
  type ChatMessageView,
  type ChatRole,
  type ChatStreamEvent,
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
  grounding?: unknown;
  createdAt: Date;
}

type RepliedOutcome = Extract<ChatReplyOutcome, { kind: 'replied' }>;

/** A send that passed every check, with its user message already stored. */
interface PreparedSend {
  threadId: string;
  content: string;
  caseIds: string[];
  hasAttachedFile: boolean;
  threadNeedsTitle: boolean;
  locale: 'es' | 'en';
  userRow: MessageRow;
  attachedCasesById: ReadonlyMap<string, AttachedCaseView>;
  replyInput: ChatReplyInput;
}

function readGrounding(value: unknown): GroundingView | null {
  const parsed = groundingDeclarationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
    grounding: readGrounding(row.grounding),
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

const UNTARGETED_CHAT_CASE_KEY_MARKER = ':new:';

function untargetedChatCaseKey(messageId: string, caseIndex: number): string {
  return `${messageId}${UNTARGETED_CHAT_CASE_KEY_MARKER}${caseIndex}`;
}

function parseUntargetedChatCaseKey(
  key: string,
): { messageId: string; caseIndex: number } | null {
  const markerIndex = key.indexOf(UNTARGETED_CHAT_CASE_KEY_MARKER);
  if (markerIndex === -1) return null;

  const messageId = key.slice(0, markerIndex);
  const caseIndex = Number(
    key.slice(markerIndex + UNTARGETED_CHAT_CASE_KEY_MARKER.length),
  );
  if (messageId === '' || Number.isNaN(caseIndex)) return null;

  return { messageId, caseIndex };
}

const CASE_CANDIDATE_SELECT = {
  id: true,
  suiteId: true,
  automationKey: true,
  name: true,
  steps: true,
  expectedResult: true,
} as const;

interface CaseCandidateRow {
  id: string;
  suiteId: string;
  automationKey: string | null;
  name: string;
  steps: string[];
  expectedResult: string;
}

function toClassifyCandidate(row: CaseCandidateRow): ClassifyProposalCandidate {
  return {
    id: row.id,
    suiteId: row.suiteId,
    automationKey: row.automationKey,
    title: row.name,
    steps: row.steps,
    expectedResult: row.expectedResult,
  };
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

function uniqueNonBlank(
  values: ReadonlyArray<string | null | undefined>,
): string[] {
  const trimmed = values.flatMap((value) => {
    const candidate = value?.trim();
    return candidate === undefined || candidate.length === 0 ? [] : [candidate];
  });
  return [...new Set(trimmed)];
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
    private readonly events: DomainEvents,
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
      this.loadSentProposalIds(
        projectId,
        threadId,
        messages.filter((row) => row.role === 'assistant').map((row) => row.id),
      ),
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
    const prepared = await this.prepareSend(
      org,
      user,
      projectId,
      threadId,
      input,
    );
    if (isErr(prepared)) return prepared;

    const outcome = await this.assistant.reply(prepared.value.replyInput);
    if (outcome.kind === 'provider-unavailable') {
      return err('provider-unavailable');
    }

    const completed = await this.completeSend(org, prepared.value, outcome);
    if (isErr(completed)) return completed;

    return ok(toMessageView(completed.value));
  }

  /**
   * The streamed variant of sendMessage: same checks, same stored rows, with
   * the reply text yielded as it arrives. A failure is yielded as `failed`, so
   * a caller that has shown nothing yet can still answer it as an HTTP error.
   *
   * When the signal aborts, the stream ends without completing the send: no
   * credit is spent, no reply is stored and the title is left alone, while the
   * user message stays stored, as it does when the daily budget is exhausted.
   */
  async *streamMessage(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
    input: SendMessageInput,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const prepared = await this.prepareSend(
      org,
      user,
      projectId,
      threadId,
      input,
    );
    if (isErr(prepared)) {
      yield { type: 'failed', error: prepared.error };
      return;
    }

    let outcome: ChatReplyOutcome | undefined;
    if (!signal.aborted) {
      const events = this.assistant.replyStream(prepared.value.replyInput, {
        signal,
      });
      for await (const event of events) {
        if (event.type === 'delta') {
          yield { type: 'delta', text: event.text };
        } else if (event.type === 'case') {
          yield { type: 'case', index: event.index, case: event.case };
        } else {
          outcome = event.outcome;
        }
      }
    }

    if (signal.aborted) {
      logger.log(
        `Chat stream on thread ${threadId} aborted by the client: no reply stored, no credit spent`,
      );
      return;
    }

    if (outcome === undefined || outcome.kind === 'provider-unavailable') {
      yield { type: 'failed', error: 'provider-unavailable' };
      return;
    }

    const completed = await this.completeSend(org, prepared.value, outcome);
    if (isErr(completed)) {
      yield { type: 'failed', error: completed.error };
      return;
    }

    yield {
      type: 'done',
      userMessage: toMessageView(
        prepared.value.userRow,
        undefined,
        prepared.value.attachedCasesById,
      ),
      assistantMessage: toMessageView(completed.value),
    };
  }

  /**
   * Everything a send does before asking the model: the checks, the stored
   * user message, the daily budget and the prompt. Every failure here happens
   * before any reply text exists.
   */
  private async prepareSend(
    org: OrgContext,
    user: AuthenticatedUser,
    projectId: string,
    threadId: string,
    input: SendMessageInput,
  ): Promise<Result<PreparedSend, ChatError>> {
    const thread = await this.findThread(org, user, projectId, threadId);
    if (thread === null) return err('thread-not-found');

    const caseIds = input.caseIds ?? [];
    if (caseIds.length > MAX_ATTACHED_CASES) return err('too-many-cases');

    let attachedRows: AttachedCaseRow[] = [];
    if (caseIds.length > 0) {
      attachedRows = await this.findCasesInProject(projectId, caseIds);
      if (attachedRows.length !== caseIds.length) return err('case-not-found');
    }

    const filePath = input.filePath;
    const connection =
      caseIds.length > 0 || filePath !== undefined
        ? await this.findConnection(projectId)
        : null;

    let attachedFile: AttachedFileContext | undefined;
    if (filePath !== undefined) {
      const resolved = await this.resolveAttachedFileContext(
        filePath,
        connection,
      );
      if (resolved.kind === 'no-code-evidence') return err('file-unreadable');
      attachedFile = resolved.context;
    }

    const history = await this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
    });
    const threadNeedsTitle = !history.some(
      (message) => message.role === 'assistant',
    );

    const userRow = await this.prisma.chatMessage.create({
      data: {
        threadId,
        role: 'user',
        content: input.content,
        attachedCaseIds: caseIds,
        attachedFilePath: filePath ?? null,
      },
    });

    const withinBudget = await this.dailyBudget.tryConsume(NOT_BYOK);
    if (!withinBudget) return err('quota-exhausted');

    const [context, locale] = await Promise.all([
      this.buildContext(projectId, input.content),
      this.resolveLocale(user.id),
    ]);
    const caseContext =
      caseIds.length > 0 || attachedFile !== undefined
        ? await this.caseContextBuilder.build(
            attachedRows.map(toCaseContextCandidate),
            connection,
            attachedFile,
          )
        : undefined;

    return ok({
      threadId,
      content: input.content,
      caseIds,
      hasAttachedFile: attachedFile !== undefined,
      threadNeedsTitle,
      locale,
      userRow,
      attachedCasesById: new Map(
        attachedRows.map((row) => [
          row.id,
          { id: row.id, name: row.name, suiteName: row.suite.name },
        ]),
      ),
      replyInput: {
        locale,
        message: input.content,
        history: history
          .slice()
          .reverse()
          .map(
            (row): ChatHistoryEntry => ({
              role: row.role,
              content: row.content,
            }),
          ),
        context,
        caseContext,
      },
    });
  }

  /**
   * Grounds a finished reply, then spends the monthly credit and stores the
   * reply in one transaction, so a failed write rolls the credit back too.
   */
  private async completeSend(
    org: OrgContext,
    prepared: PreparedSend,
    outcome: RepliedOutcome,
  ): Promise<Result<MessageRow, ChatError>> {
    const { threadId, caseIds, locale, threadNeedsTitle } = prepared;
    const manifest = buildGroundingManifest(caseIds, prepared.hasAttachedFile);
    const resolution = resolveGrounding(outcome.grounding, manifest);

    const attachedIdSet = new Set(caseIds);
    const filteredCases =
      resolution.outcome === 'grounded'
        ? outcome.cases.map((suggested) =>
            stripUnattachedTarget(suggested, attachedIdSet),
          )
        : [];
    const replyContent =
      resolution.outcome === 'fabricated'
        ? buildGroundingDeclineReply(locale)
        : outcome.reply;

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
            content: replyContent,
            suggestedCases: filteredCases,
            grounding: resolution.view as Prisma.InputJsonValue,
            promptVersion: CHAT_PROMPT_VERSION,
            totalTokens: outcome.usage.totalTokens,
          },
        });
        await tx.chatThread.update({
          where: { id: threadId },
          data: threadNeedsTitle
            ? {
                title: threadTitleFrom(prepared.content),
                updatedAt: new Date(),
              }
            : { updatedAt: new Date() },
        });
        return created;
      },
    );

    if (assistantRow === null) return err('ai-not-enabled');

    return ok(assistantRow);
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
        org.organizationId,
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

    const chatCaseKey = untargetedChatCaseKey(messageId, input.caseIndex);

    const existingByChatCaseKey = await this.prisma.extractedProposal.findFirst(
      {
        where: { projectId, chatCaseKey },
        select: { id: true },
      },
    );
    if (existingByChatCaseKey !== null) {
      return ok({ proposalId: existingByChatCaseKey.id, alreadySent: true });
    }

    const suite = await this.prisma.suite.findFirst({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (suite === null) return err('missing-suite');

    const precedingUserMessage = await this.prisma.chatMessage.findFirst({
      where: { threadId, role: 'user', createdAt: { lt: message.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { attachedFilePath: true },
    });
    // The file the person attached comes first; the path the assistant proposed
    // is a fallback. Both go through the same read and evidence gate, so a path
    // the repository does not back keeps the case gated.
    const evidencePaths = uniqueNonBlank([
      precedingUserMessage?.attachedFilePath,
      suggested.evidencePath,
    ]);
    if (evidencePaths.length === 0) {
      return err('no-code-evidence');
    }

    const connection = await this.findConnection(projectId);
    const evidence = await this.firstVerifiedEvidence(
      evidencePaths,
      connection,
    );
    if (evidence === null) {
      return err('no-code-evidence');
    }

    const classification = await this.classifyChatProposal(
      projectId,
      suite.id,
      {
        automationKey: null,
        title: suggested.title,
        steps: suggested.steps,
        expectedResult: suggested.expectedResult,
      },
    );

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
            suiteId: suite.id,
            chatCaseKey,
            status: 'in_review',
            title: suggested.title,
            objective: suggested.objective,
            preconditions: suggested.preconditions,
            steps: suggested.steps,
            expectedResult: suggested.expectedResult,
            priority: suggested.priority,
            promptVersion: CHAT_PROMPT_VERSION,
            duplicateKind: classification.kind,
            matchedCaseId: classification.matchedCaseId,
            duplicateScore: classification.score,
            duplicateReasons: classification.reasons,
            classifiedAt: new Date(),
          },
          select: { id: true },
        });
      });

      this.announceProposal(org.organizationId, projectId, proposal.id);

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

  /**
   * One chat proposal is its own batch, identified by its proposal id. It is
   * announced after the commit, and only by the request that created it: a
   * repeated send and the loser of a double submit return the existing proposal.
   */
  private announceProposal(
    organizationId: string,
    projectId: string,
    proposalId: string,
  ): void {
    this.events.publish(DOMAIN_EVENTS.proposalsCreated, {
      source: 'chat',
      organizationId,
      projectId,
      batchId: proposalId,
      count: 1,
    });
  }

  /**
   * Mirrors ReclassifySuiteProcessor's duplicate detection for proposals Aeris
   * sends to review, so they carry the same duplicateKind/matchedCaseId signal
   * a reviewer sees for a push-originated proposal, instead of always 'none'.
   */
  private async classifyChatProposal(
    projectId: string,
    suiteId: string,
    proposal: {
      automationKey: string | null;
      title: string;
      steps: readonly string[];
      expectedResult: string;
    },
  ): Promise<ProposalClassification> {
    const suiteCases = (await this.prisma.testCase.findMany({
      where: { suiteId },
      select: CASE_CANDIDATE_SELECT,
    })) as CaseCandidateRow[];

    const crossSuiteCases =
      proposal.automationKey === null
        ? []
        : ((await this.prisma.testCase.findMany({
            where: {
              projectId,
              suiteId: { not: suiteId },
              automationKey: proposal.automationKey,
            },
            select: CASE_CANDIDATE_SELECT,
          })) as CaseCandidateRow[]);

    const candidates = [...suiteCases, ...crossSuiteCases].map(
      toClassifyCandidate,
    );

    return classifyProposal(
      {
        automationKey: proposal.automationKey,
        suiteId,
        title: proposal.title,
        steps: proposal.steps,
        expectedResult: proposal.expectedResult,
      },
      candidates,
      suiteId,
    );
  }

  private async sendTargetedToReview(
    organizationId: string,
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

    const classification = await this.classifyChatProposal(
      projectId,
      target.suiteId,
      {
        automationKey: target.automationKey,
        title: suggested.title,
        steps: suggested.steps,
        expectedResult: suggested.expectedResult,
      },
    );

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
            duplicateKind: classification.kind,
            matchedCaseId: classification.matchedCaseId,
            duplicateScore: classification.score,
            duplicateReasons: classification.reasons,
            classifiedAt: new Date(),
          },
          select: { id: true },
        });
      });

      this.announceProposal(organizationId, projectId, proposal.id);

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

  private async firstVerifiedEvidence(
    filePaths: readonly string[],
    connection: CaseContextConnection | null,
  ): Promise<TargetedEvidence | null> {
    for (const filePath of filePaths) {
      const result = await this.buildUntargetedEvidence(filePath, connection);
      if (result.kind === 'ok') return result.evidence;
    }
    return null;
  }

  private async buildUntargetedEvidence(
    filePath: string,
    connection: CaseContextConnection | null,
  ): Promise<TargetedEvidenceResult> {
    if (connection === null) {
      const gated = gate(null);
      return gated.kind === 'no-code-evidence'
        ? gated
        : { kind: 'no-code-evidence', reason: 'no-evidence' };
    }

    const { ref, excerpt } = await this.caseContextBuilder.locateForEvidence(
      { automationKey: null, automationFilePath: filePath },
      connection,
    );

    const gated = gate(excerpt);
    if (gated.kind === 'no-code-evidence') {
      return gated;
    }

    const uri = buildBlobUrl(
      connection.provider,
      connection.repo,
      ref,
      filePath,
    );
    return { kind: 'ok', evidence: { uri, excerpt: gated.excerpt } };
  }

  private async resolveAttachedFileContext(
    filePath: string,
    connection: CaseContextConnection | null,
  ): Promise<
    { kind: 'ok'; context: AttachedFileContext } | { kind: 'no-code-evidence' }
  > {
    if (connection === null) {
      return { kind: 'no-code-evidence' };
    }

    const { ref, excerpt } = await this.caseContextBuilder.locateForEvidence(
      { automationKey: null, automationFilePath: filePath },
      connection,
    );
    if (excerpt.kind === 'unavailable') {
      return { kind: 'no-code-evidence' };
    }

    const gated = gate(excerpt);
    if (gated.kind === 'no-code-evidence') {
      return { kind: 'no-code-evidence' };
    }

    return { kind: 'ok', context: { path: filePath, ref, excerpt } };
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
    assistantMessageIds: readonly string[],
  ): Promise<Map<string, Record<number, string>>> {
    const prefix = `qably://chat/${threadId}/`;
    const candidateChatCaseKeys = assistantMessageIds.flatMap((messageId) =>
      Array.from({ length: MAX_SUGGESTED_CASES }, (_, caseIndex) =>
        untargetedChatCaseKey(messageId, caseIndex),
      ),
    );

    const [legacyProposals, chatCaseKeyProposals] = await Promise.all([
      this.prisma.extractedProposal.findMany({
        where: { projectId, evidence: { uri: { startsWith: prefix } } },
        select: { id: true, evidence: { select: { uri: true } } },
      }),
      candidateChatCaseKeys.length === 0
        ? Promise.resolve([])
        : this.prisma.extractedProposal.findMany({
            where: { projectId, chatCaseKey: { in: candidateChatCaseKeys } },
            select: { id: true, chatCaseKey: true },
          }),
    ]);

    const map = new Map<string, Record<number, string>>();
    for (const proposal of legacyProposals) {
      const parsed = parseChatEvidenceUri(prefix, proposal.evidence.uri);
      if (parsed === null) continue;

      const existing = map.get(parsed.messageId) ?? {};
      existing[parsed.caseIndex] = proposal.id;
      map.set(parsed.messageId, existing);
    }
    for (const proposal of chatCaseKeyProposals) {
      if (typeof proposal.chatCaseKey !== 'string') continue;

      const parsed = parseUntargetedChatCaseKey(proposal.chatCaseKey);
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

  private async readSuiteSummaries(
    projectId: string,
  ): Promise<Array<{ id: string; name: string; cases: number }>> {
    const suites = await this.prisma.suite.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    // Only active cases count: a suite whose cases were all deprecated or whose
    // spec was deleted must reach the prompt as empty, not as covered.
    const caseCounts = await readSuiteCaseCounts(
      this.prisma,
      suites.map((suite) => suite.id),
      { activeOnly: true },
    );

    return suites.map((suite) => ({
      id: suite.id,
      name: suite.name,
      cases: caseCounts.get(suite.id) ?? 0,
    }));
  }

  /**
   * One read for the distinct test files of every active case in the project;
   * draft and deprecated cases are left out, as they are from the case counts.
   */
  private readSuiteFileRows(projectId: string): Promise<SuiteFileRow[]> {
    return this.prisma.testCase.findMany({
      where: { projectId, state: 'active', automationFilePath: { not: null } },
      select: { suiteId: true, automationFilePath: true },
      distinct: ['suiteId', 'automationFilePath'],
    });
  }

  /**
   * Case titles ranked by trigram similarity to the user's message, not by
   * recency: beyond CONTEXT_CASE_LIMIT active cases, "most recently updated"
   * crowds out the titles actually relevant to what was asked. Ties (no
   * shared trigrams, e.g. a generic greeting) fall back to updatedAt desc,
   * matching the previous behavior.
   */
  private async rankCaseTitles(
    projectId: string,
    message: string,
  ): Promise<{ name: string }[]> {
    return this.prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
      SELECT name
        FROM "test_case"
       WHERE "projectId" = ${projectId} AND state = 'active'
       ORDER BY similarity(name, ${message}) DESC, "updatedAt" DESC
       LIMIT ${CONTEXT_CASE_LIMIT}
    `);
  }

  private async buildContext(
    projectId: string,
    message: string,
  ): Promise<ChatProjectContext> {
    const [project, suites, fileRows, cases, runs] = await Promise.all([
      this.prisma.project.findFirst({
        where: { id: projectId },
        select: { name: true, connection: { select: { repo: true } } },
      }),
      this.readSuiteSummaries(projectId),
      this.readSuiteFileRows(projectId),
      this.rankCaseTitles(projectId, message),
      this.prisma.run.findMany({
        where: { projectId },
        select: { name: true, status: true, startedAt: true },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: CONTEXT_RUN_LIMIT,
      }),
    ]);

    const connectedRepo = project?.connection?.repo;
    const repoName =
      connectedRepo === undefined ? undefined : splitRepo(connectedRepo).repo;
    const filesBySuite = indexSuiteFiles(
      suites.map((suite) => suite.id),
      fileRows,
      repoName,
    );

    return {
      projectName: project?.name ?? projectId,
      suites: suites.map(({ id, name, cases: count }) => {
        const files = filesBySuite.get(id);
        return files === undefined
          ? { name, cases: count }
          : { name, cases: count, ...files };
      }),
      caseTitles: cases.map((testCase) => testCase.name),
      recentRuns: runs.map((run) => ({ name: run.name, status: run.status })),
    };
  }
}
