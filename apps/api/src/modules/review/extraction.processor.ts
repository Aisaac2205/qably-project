import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import {
  PLAN_LIMITS,
  assessCaseDocumentation,
  assessSuiteDocumentation,
} from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import { assertNever } from '../../common/assert-never';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import { TEST_CASE_EXTRACTOR } from '../ai/ai.tokens';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import {
  CASE_LIMITS,
  MAX_EXTRACTED_CASES,
  SUITE_LIMITS,
  type ExtractedCase,
  type ExtractedSuite,
  type ExtractionInput,
  type ExtractionOutcome,
  type ExtractionTargetDeclaration,
  type TestCaseExtractor,
} from '../ai/extraction.contracts';
import { countTestDeclarations } from '../ai/count-test-declarations';
import { buildTargetManifest } from '../ai/target-reference';
import {
  SourceReader,
  type SourceReadResult,
} from '../repository/source-reader';
import { splitRepo } from '../repository/lib/split-repo';
import { TestFileLocator } from '../repository/test-file-locator';
import { normalizeAutomationFilePath } from '../../common/paths/normalize-automation-file-path';
import { OnDemandProcessor } from '../../common/queue/on-demand-processor.decorator';
import {
  describeTruncatedSource,
  diagnoseNameCollision,
  summarizeUnmatchedTargets,
} from './document-file-diagnostics';
import {
  buildDeclarationSnapshot,
  diffDeclarations,
  matchTargetedCases,
  readDeclarationSnapshot,
  readDeclaredFile,
  type DeclarationSnapshot,
  type DeclaredFile,
  type SnapshotDeclaration,
} from './lib/change-detection';
import { detectLanguage } from './lib/detect-language';
import { fingerprintSource } from './lib/source-fingerprint';
import {
  isSameDocumentation,
  type DocumentationStateWrite,
  type PublishTestCaseVersionFields,
} from './lib/publish-test-case-version';
import { publishWithNameFallback } from './lib/publish-with-name-fallback';
import {
  PENDING_PROPOSAL_CASES_SELECT,
  casesWithPendingProposal,
  pendingProposalsWhere,
} from './lib/pending-proposals';
import {
  RetryableTransactionConflictError,
  isTransientTransactionConflict,
  retryTransientConflicts,
} from './lib/transient-transaction-conflict';
import { normalizeAutomationKey } from './lib/normalize-automation-key';
import { testCaseUniqueConstraint } from './lib/test-case-unique-constraint';
import {
  dedupeByAutomationKey,
  matchRound,
} from './lib/match-document-targets';
import { resolveAutomationFilePath } from './lib/resolve-automation-file-path';
import { locateAndPersistAutomationFilePath } from './lib/locate-and-persist-automation-file-path';
import {
  incompleteExtractionNote,
  incompleteTargetNote,
} from './lib/incomplete-extraction-note';
import {
  EXTRACTION_QUEUE,
  type DocumentFileTarget,
  type ExtractionJobData,
} from './review.contracts';
import {
  RetryableProviderError,
  type DocumentFileJobContext,
  type JobContext,
  type TxClient,
} from './extraction.types';
import { ExtractionFailureRecorder } from './extraction-failure-recorder';
import { ExtractedProposalWriter } from './extracted-proposal-writer';
import { ProposalReclassifier } from '../proposal-classification/proposal-reclassifier';

const MAX_CASE_OBSERVATIONS = CASE_LIMITS.observations;
const HEAD_REF = 'HEAD';
const NOT_ENTITLED_REASON = 'ai-not-enabled';
const NO_MATCHING_CASE_REASON = 'automation-key-not-found';
const NO_TESTS_FOUND_REASON = 'no-tests-found';
const EXTRACTION_INCOMPLETE_REASON = 'extraction-incomplete';
const SOURCE_TRUNCATED_REASON = 'source-truncated';
const EXTRACTION_FAILED_REASON = 'extraction-failed';
const QUOTA_EXHAUSTED_REASON = 'quota-exhausted';
const NOT_BYOK = { isByok: false };
const LOCK_DURATION_MS = 120_000;
const HUMAN_DOCUMENTATION_SOURCE = 'human';
const AERIS_DOCUMENTATION_SOURCE = 'aeris';
const HUMAN_NAME_SOURCE = 'human';
const AERIS_NAME_SOURCE = 'aeris';
const SUITE_METADATA_SAVEPOINT = 'suite_metadata';
const SUITE_SUMMARY_SAVEPOINT = 'suite_summary_metadata';
const SUITE_SUMMARY_MAX_CASES = 60;
const SUITE_TAG_CAP = SUITE_LIMITS.tags;
const SUITE_STATES_FOR_SUMMARY = ['active', 'draft'] as const;

interface SourceFingerprint {
  codeChangeId: string;
  sourceHash: string;
}

interface PushStamp {
  id: string;
  commitSha: string;
  sourceHash: string | null;
  extractedAt: Date | null;
  declarationSnapshot: unknown;
}

const PUSH_STAMP_SELECT = {
  id: true,
  commitSha: true,
  sourceHash: true,
  extractedAt: true,
  declarationSnapshot: true,
} as const;

/** What the fingerprint gate found, handed on to change detection. */
interface PushComparison {
  skipped: boolean;
  own: PushStamp | null;
  previous: PushStamp | null;
}

/**
 * A file shorter than this fit under every plan, so no extraction of it was
 * ever cut, whatever limit applied when it ran.
 */
const SMALLEST_PLAN_SOURCE_LIMIT = Math.min(
  ...Object.values(PLAN_LIMITS).map((limits) => limits.maxSourceCharacters),
);

function unmatchedReasonFor(sourceTruncated: boolean): string {
  return sourceTruncated ? SOURCE_TRUNCATED_REASON : NO_MATCHING_CASE_REASON;
}

/**
 * The value written to `CodeChange.declarationSnapshot`. A nullable JSON
 * column cannot take a bare null through Prisma: clearing it needs `DbNull`.
 */
function snapshotColumn(
  snapshot: DeclarationSnapshot | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return snapshot === null ? Prisma.DbNull : snapshot;
}

/**
 * Plain tests per model call. Below `MAX_EXTRACTED_CASES`, so a model that
 * answers a few extra cases does not push a requested one past the cap.
 */
const PLAIN_TARGETS_PER_CALL = 15;

/**
 * The changed declarations, in source order, one model call's worth each:
 * plain tests in groups of at most `PLAIN_TARGETS_PER_CALL`, and every table
 * (`.each`/`.for`) alone, since it is answered with one case per row and its
 * rows alone can fill the cap.
 */
function chunkTargets(
  declarations: readonly SnapshotDeclaration[],
): SnapshotDeclaration[][] {
  const chunks: SnapshotDeclaration[][] = [];
  let plain: SnapshotDeclaration[] = [];
  const flush = (): void => {
    if (plain.length > 0) chunks.push(plain);
    plain = [];
  };

  for (const declaration of declarations) {
    if (declaration.parametrized) {
      flush();
      chunks.push([declaration]);
      continue;
    }
    plain.push(declaration);
    if (plain.length === PLAIN_TARGETS_PER_CALL) flush();
  }
  flush();

  return chunks;
}

/** What the model is told about a declaration: its name and where it is. */
function toTargetDeclaration(
  declaration: SnapshotDeclaration,
): ExtractionTargetDeclaration {
  return {
    describePath: declaration.describePath,
    title: declaration.title,
    startLine: declaration.startLine,
    endLine: declaration.endLine,
    parametrized: declaration.parametrized,
  };
}

/**
 * Tells the reviewer that the push's other requested tests did not come back,
 * like the document-file note, on every case that has room for it.
 */
function withIncompleteTargetNote(
  cases: readonly ExtractedCase[],
  described: number,
  requested: number,
  locale: 'es' | 'en',
): ExtractedCase[] {
  const note = incompleteTargetNote(described, requested, locale);

  return cases.map((testCase) => {
    const observations = testCase.observations ?? [];
    if (observations.length >= MAX_CASE_OBSERVATIONS) return testCase;
    return { ...testCase, observations: [...observations, note] };
  });
}

async function lockTestCases(tx: TxClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  // FOR NO KEY UPDATE serializes the writers of these cases but, unlike FOR
  // UPDATE, lets a proposal referencing them take its foreign-key share lock.
  await tx.$executeRawUnsafe(
    `SELECT id FROM "test_case" WHERE id IN (${placeholders}) ORDER BY id FOR NO KEY UPDATE`,
    ...ids,
  );
}

interface SuiteMetadataLock {
  nameSource: string;
  tags: string[];
}

async function lockSuiteMetadata(
  tx: TxClient,
  suiteId: string,
): Promise<SuiteMetadataLock | null> {
  const rows = await tx.$queryRawUnsafe<
    { nameSource: string; tags: string[] | null }[]
  >(`SELECT "nameSource", tags FROM "suite" WHERE id = $1 FOR UPDATE`, suiteId);

  const row = rows[0];
  if (row === undefined) return null;

  return { nameSource: row.nameSource, tags: row.tags ?? [] };
}

/** Rolls back a suite summary whose suite this run no longer owns. */
class SuiteSummaryNotOwned extends Error {
  constructor() {
    super('suite summary is no longer queued');
  }
}

interface SuiteSummaryLock {
  name: string;
  nameSource: string;
  tags: string[];
  documentationQueuedAt: Date | null | undefined;
}

async function lockSuiteForSummary(
  tx: TxClient,
  suiteId: string,
): Promise<SuiteSummaryLock | null> {
  const rows = await tx.$queryRawUnsafe<
    {
      name: string;
      nameSource: string;
      tags: string[] | null;
      documentationQueuedAt?: Date | null;
    }[]
  >(
    `SELECT name, "nameSource", tags, "documentationQueuedAt" FROM "suite" WHERE id = $1 FOR UPDATE`,
    suiteId,
  );

  const row = rows[0];
  if (row === undefined) return null;

  return {
    name: row.name,
    nameSource: row.nameSource,
    tags: row.tags ?? [],
    documentationQueuedAt: row.documentationQueuedAt,
  };
}

/**
 * A human-added tag is never removed: the result keeps every existing tag
 * and appends any Aeris-proposed tag that is not already present. Aeris can
 * grow the tag set but never shrinks it.
 */
function mergeSuiteTags(
  existing: readonly string[],
  proposed: readonly string[],
): string[] {
  const merged = [...existing];
  if (merged.length >= SUITE_TAG_CAP) return merged.slice(0, SUITE_TAG_CAP);

  const seen = new Set(existing);

  for (const tag of proposed) {
    if (merged.length >= SUITE_TAG_CAP) break;
    if (seen.has(tag)) continue;
    seen.add(tag);
    merged.push(tag);
  }

  return merged;
}

@OnDemandProcessor(EXTRACTION_QUEUE, {
  concurrency: 2,
  lockDuration: LOCK_DURATION_MS,
})
export class ExtractionProcessor {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceReader: SourceReader,
    @Inject(TEST_CASE_EXTRACTOR) private readonly extractor: TestCaseExtractor,
    private readonly encryption: EncryptionService,
    private readonly entitlement: AiEntitlementService,
    private readonly dailyBudget: AiDailyBudget,
    private readonly testFileLocator: TestFileLocator,
    private readonly failureRecorder: ExtractionFailureRecorder,
    private readonly proposalWriter: ExtractedProposalWriter,
    @InjectEnv() private readonly env: Env,
    private readonly reclassifier: ProposalReclassifier,
  ) {}

  async process(job: Job<ExtractionJobData>): Promise<void> {
    // job.attemptsStarted/job.opts may be absent on minimal job doubles in
    // tests — default to "this is the only/last attempt" so a retryable
    // failure falls back to manual review rather than throwing with nothing
    // left to catch it.
    const attemptsStarted = job.attemptsStarted ?? 1;
    const maxAttempts = job.opts?.attempts ?? 1;
    const isFinalAttempt = attemptsStarted >= maxAttempts;
    const isFirstAttempt = attemptsStarted <= 1;

    switch (job.data.kind) {
      case 'code-change':
        await this.processCodeChange(
          job.data.codeChangeId,
          job.data.locale,
          isFinalAttempt,
          isFirstAttempt,
        );
        return;
      case 'document-case':
        await this.processDocumentCase(
          job.data.testCaseId,
          job.data.locale,
          isFinalAttempt,
          isFirstAttempt,
        );
        return;
      case 'document-file':
        await this.processDocumentFile(
          job.data.filePath,
          job.data.targets,
          job.data.locale,
          job.data.requestSuiteSummary ?? true,
          isFinalAttempt,
          isFirstAttempt,
        );
        return;
      case 'document-suite-metadata':
        await this.processDocumentSuiteMetadata(
          job.data.suiteId,
          job.data.locale,
          isFinalAttempt,
          isFirstAttempt,
        );
        return;
      default:
        assertNever(job.data);
    }
  }

  private async processCodeChange(
    codeChangeId: string,
    locale: string | undefined,
    isFinalAttempt: boolean,
    isFirstAttempt: boolean,
  ): Promise<void> {
    const codeChange = await this.prisma.codeChange.findUnique({
      where: { id: codeChangeId },
      select: {
        id: true,
        projectId: true,
        filePath: true,
        commitSha: true,
        evidenceId: true,
        createdAt: true,
        batch: { select: { scmEvent: { select: { branch: true } } } },
        project: {
          select: {
            organizationId: true,
            connection: {
              select: {
                provider: true,
                repo: true,
                encryptedAccessToken: true,
              },
            },
          },
        },
      },
    });

    if (codeChange === null) {
      this.logger.warn(`Code change ${codeChangeId} no longer exists`);
      return;
    }

    // Optional chaining on purpose: the batch is required in the schema, but a
    // missing branch must only cost the branch filter, never fail the job.
    const branch = codeChange.batch?.scmEvent?.branch ?? null;

    await this.runExtraction({
      projectId: codeChange.projectId,
      organizationId: codeChange.project.organizationId,
      filePath: codeChange.filePath,
      ref: codeChange.commitSha,
      connection: codeChange.project.connection,
      codeChangeId: codeChange.id,
      codeChangeCreatedAt: codeChange.createdAt,
      codeChangeBranch: branch,
      targetTestCaseId: null,
      knownSuiteId: null,
      onlyAutomationKey: null,
      locale,
      isFinalAttempt,
      isFirstAttempt,
    });
  }

  private async processDocumentCase(
    testCaseId: string,
    locale: string | undefined,
    isFinalAttempt: boolean,
    isFirstAttempt: boolean,
  ): Promise<void> {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: {
        id: true,
        projectId: true,
        suiteId: true,
        name: true,
        automationKey: true,
        automationFilePath: true,
        automationClassName: true,
        suite: { select: { name: true } },
        project: {
          select: {
            organizationId: true,
            connection: {
              select: {
                provider: true,
                repo: true,
                encryptedAccessToken: true,
              },
            },
          },
        },
      },
    });

    if (testCase === null) {
      this.logger.warn(`Test case ${testCaseId} is no longer documentable`);
      return;
    }

    const filePath =
      testCase.automationFilePath ??
      (await resolveAutomationFilePath(
        this.prisma,
        testCase.projectId,
        testCase.automationKey,
        testCase.automationClassName,
      )) ??
      (await locateAndPersistAutomationFilePath(
        {
          locate: (input) => this.testFileLocator.locate(input),
          decrypt: (value) => this.encryption.decrypt(value),
          persist: (id, path) =>
            this.prisma.testCase
              .update({ where: { id }, data: { automationFilePath: path } })
              .then(() => undefined),
        },
        {
          testCaseId: testCase.id,
          automationKey: testCase.automationKey,
          automationClassName: testCase.automationClassName,
          caseName: testCase.name,
          suiteName: testCase.suite?.name ?? null,
          connection: testCase.project.connection,
          ref: HEAD_REF,
        },
      ));

    if (filePath === null) {
      this.logger.warn(
        `Test case ${testCaseId} has no source file in the connected repository`,
      );
      return;
    }

    const ref = await this.latestCommitShaFor(testCase.projectId, filePath);

    await this.runExtraction({
      projectId: testCase.projectId,
      organizationId: testCase.project.organizationId,
      filePath,
      ref,
      connection: testCase.project.connection,
      codeChangeId: null,
      targetTestCaseId: testCase.id,
      knownSuiteId: testCase.suiteId,
      onlyAutomationKey: testCase.automationKey,
      locale,
      isFinalAttempt,
      isFirstAttempt,
    });
  }

  private async latestCommitShaFor(
    projectId: string,
    filePath: string,
  ): Promise<string> {
    const latest = await this.prisma.codeChange.findFirst({
      where: { projectId, filePath },
      orderBy: { createdAt: 'desc' },
      select: { commitSha: true },
    });

    return latest?.commitSha ?? HEAD_REF;
  }

  private async processDocumentSuiteMetadata(
    suiteId: string,
    locale: string | undefined,
    isFinalAttempt: boolean,
    isFirstAttempt: boolean,
  ): Promise<void> {
    try {
      await this.processDocumentSuiteMetadataUnsafe(
        suiteId,
        locale,
        isFinalAttempt,
        isFirstAttempt,
      );
    } catch (error) {
      if (error instanceof RetryableProviderError) throw error;
      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(
        `Suite metadata summary for ${suiteId} failed unexpectedly: ${reason}`,
      );
      await this.persistSuiteOutcome(
        suiteId,
        'failed',
        EXTRACTION_FAILED_REASON,
      );
    }
  }

  private async processDocumentSuiteMetadataUnsafe(
    suiteId: string,
    locale: string | undefined,
    isFinalAttempt: boolean,
    isFirstAttempt: boolean,
  ): Promise<void> {
    const suite = await this.prisma.suite.findFirst({
      where: { id: suiteId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        description: true,
        tags: true,
        nameSource: true,
        cases: {
          where: { state: { in: [...SUITE_STATES_FOR_SUMMARY] } },
          take: SUITE_SUMMARY_MAX_CASES,
          select: { name: true, objective: true },
        },
      },
    });

    if (suite === null) {
      this.logger.warn(`Suite ${suiteId} no longer exists`);
      return;
    }

    const assessment = assessSuiteDocumentation({
      name: suite.name,
      description: suite.description,
      tags: suite.tags,
    });

    if (suite.nameSource === HUMAN_NAME_SOURCE && assessment.complete) {
      await this.persistSuiteOutcome(suiteId, 'skipped', 'human-documented');
      return;
    }

    const entitled = await this.entitlement.isEntitled(suite.organizationId);
    if (!entitled) {
      await this.persistSuiteOutcome(suiteId, 'failed', NOT_ENTITLED_REASON);
      return;
    }

    const withinBudget = isFirstAttempt
      ? await this.dailyBudget.tryConsume(NOT_BYOK)
      : true;
    if (!withinBudget) {
      await this.persistSuiteOutcome(suiteId, 'failed', QUOTA_EXHAUSTED_REASON);
      return;
    }

    const resolvedLocale = resolveLocale(locale);

    const outcome = await this.extractor.summarizeSuite({
      suiteName: suite.name,
      cases: suite.cases.map((testCase) => ({
        title: testCase.name,
        objective: testCase.objective,
      })),
      locale: resolvedLocale,
    });

    if (outcome.kind === 'provider-unavailable') {
      if (outcome.retryable && !isFinalAttempt) {
        throw new RetryableProviderError(outcome.reason);
      }
      await this.persistSuiteOutcome(suiteId, 'failed', outcome.reason);
      return;
    }

    const persisted = await this.persistSuiteSummary(
      suiteId,
      suite.organizationId,
      outcome.suite,
    );
    if (!persisted) {
      await this.persistSuiteOutcome(suiteId, 'failed', NOT_ENTITLED_REASON);
    }
  }

  private async persistSuiteOutcome(
    suiteId: string,
    outcome: 'failed' | 'skipped',
    reason: string,
  ): Promise<void> {
    const state: DocumentationStateWrite = {
      documentationOutcome: outcome,
      documentationSkipReason: reason,
      documentationOutcomeAt: new Date(),
      documentationQueuedAt: null,
    };

    await this.prisma.suite.updateMany({
      where: { id: suiteId, documentationQueuedAt: { not: null } },
      data: state,
    });
  }

  private async persistSuiteSummary(
    suiteId: string,
    organizationId: string,
    summary: { title: string; description: string; tags: string[] },
  ): Promise<boolean> {
    try {
      return await this.writeSuiteSummary(suiteId, organizationId, summary);
    } catch (error) {
      // The suite is gone, or a fresher run already wrote its summary: the
      // transaction rolled back, credit included, and there is nothing to do.
      if (error instanceof SuiteSummaryNotOwned) return true;
      throw error;
    }
  }

  private writeSuiteSummary(
    suiteId: string,
    organizationId: string,
    summary: { title: string; description: string; tags: string[] },
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx: TxClient) => {
      // Lock order, shared with the document-file job: the organization row
      // (spending the credit updates it) before the suite row. Spending first
      // means a run that turns out not to own the suite must roll back to give
      // the credit back.
      const spent = await this.entitlement.spendCredit(organizationId, tx);
      if (!spent) return false;

      const locked = await lockSuiteForSummary(tx, suiteId);
      if (locked === null || locked.documentationQueuedAt === null) {
        throw new SuiteSummaryNotOwned();
      }

      const mergedTags = mergeSuiteTags(locked.tags, summary.tags);
      const nameChanged = locked.nameSource !== HUMAN_NAME_SOURCE;
      const nextName = nameChanged ? summary.title : locked.name;

      const assessment = assessSuiteDocumentation({
        name: nextName,
        description: summary.description,
        tags: mergedTags,
      });

      const documentedState: DocumentationStateWrite = {
        documentationOutcome: assessment.complete ? 'complete' : 'incomplete',
        documentationMissing: assessment.missing,
        documentationOutcomeAt: new Date(),
        documentationQueuedAt: null,
        documentationSkipReason: null,
      };

      const baseData = {
        description: summary.description,
        tags: mergedTags,
        ...documentedState,
      };

      const ownershipWhere = {
        id: suiteId,
        documentationQueuedAt: { not: null },
      };

      await tx.$executeRawUnsafe(`SAVEPOINT ${SUITE_SUMMARY_SAVEPOINT}`);

      try {
        await tx.suite.updateMany({
          where: ownershipWhere,
          data: nameChanged
            ? {
                ...baseData,
                name: summary.title,
                nameSource: AERIS_NAME_SOURCE,
              }
            : baseData,
        });

        await tx.$executeRawUnsafe(
          `RELEASE SAVEPOINT ${SUITE_SUMMARY_SAVEPOINT}`,
        );
        return true;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        await tx.$executeRawUnsafe(
          `ROLLBACK TO SAVEPOINT ${SUITE_SUMMARY_SAVEPOINT}`,
        );
        await tx.$executeRawUnsafe(
          `RELEASE SAVEPOINT ${SUITE_SUMMARY_SAVEPOINT}`,
        );

        this.logger.log(
          `Skipped renaming suite ${suiteId} to "${summary.title}": the proposed name collides with another suite in this project`,
        );

        await tx.suite.updateMany({ where: ownershipWhere, data: baseData });
        return true;
      }
    });
  }

  private async processDocumentFile(
    filePath: string,
    targets: DocumentFileTarget[],
    locale: string | undefined,
    requestSuiteSummary: boolean,
    isFinalAttempt: boolean,
    isFirstAttempt: boolean,
  ): Promise<void> {
    if (targets.length === 0) return;

    const firstTarget = await this.prisma.testCase.findUnique({
      where: { id: targets[0].testCaseId },
      select: {
        projectId: true,
        project: {
          select: {
            organizationId: true,
            connection: {
              select: {
                provider: true,
                repo: true,
                encryptedAccessToken: true,
              },
            },
          },
        },
      },
    });

    if (firstTarget === null) {
      this.logger.warn(
        `Document-file job for ${filePath} has no resolvable project (target case is gone)`,
      );
      return;
    }

    const ref = await this.latestCommitShaFor(firstTarget.projectId, filePath);

    await this.runDocumentFileExtraction({
      projectId: firstTarget.projectId,
      organizationId: firstTarget.project.organizationId,
      filePath,
      ref,
      connection: firstTarget.project.connection,
      targets,
      locale,
      requestSuiteSummary,
      isFinalAttempt,
      isFirstAttempt,
    });
  }

  private async runDocumentFileExtraction(
    ctx: DocumentFileJobContext,
  ): Promise<void> {
    try {
      await this.runDocumentFileExtractionUnsafe(ctx);
    } catch (error) {
      if (error instanceof RetryableProviderError) throw error;
      // Only the documentation transaction raises this, after its in-process
      // attempts all lost and before anything committed, so running the job
      // again repeats no committed work. A conflict anywhere else, after the
      // commit included, is recorded like any other failure.
      if (
        !ctx.isFinalAttempt &&
        error instanceof RetryableTransactionConflictError
      ) {
        this.logger.warn(
          `Document-file extraction for ${ctx.filePath} lost a transaction conflict on every attempt; the queue will retry it`,
        );
        throw error;
      }
      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(
        `Document-file extraction for ${ctx.filePath} failed unexpectedly: ${reason}`,
      );
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        EXTRACTION_FAILED_REASON,
      );
    }
  }

  private async runDocumentFileExtractionUnsafe(
    ctx: DocumentFileJobContext,
  ): Promise<void> {
    if (ctx.connection === null) {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        'no-connection',
      );
      return;
    }

    const entitled = await this.entitlement.isEntitled(ctx.organizationId);
    if (!entitled) {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        NOT_ENTITLED_REASON,
      );
      return;
    }

    const { owner, repo } = splitRepo(ctx.connection.repo);
    const accessToken =
      ctx.connection.encryptedAccessToken === null
        ? undefined
        : this.encryption.decrypt(ctx.connection.encryptedAccessToken);

    const source = await this.sourceReader.read({
      provider: ctx.connection.provider,
      owner,
      repo,
      ref: ctx.ref,
      path: normalizeAutomationFilePath(ctx.filePath, repo),
      accessToken,
      maxContentLength: await this.entitlement.maxSourceCharacters(
        ctx.organizationId,
      ),
    });

    if (source.kind === 'unavailable') {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        source.reason,
      );
      return;
    }

    if (source.truncated) {
      this.logger.warn(
        describeTruncatedSource(ctx.filePath, source.content.length),
      );
    }

    // Only charge the daily budget once per logical extraction: a retry of
    // this same job (after a retryable provider failure) already spent a
    // unit on its first attempt, so re-checking here would double/triple
    // count one extraction against the org's cap during a provider outage —
    // exactly when budget should be conserved, not burned fastest.
    const withinBudget = ctx.isFirstAttempt
      ? await this.dailyBudget.tryConsume(NOT_BYOK)
      : true;
    if (!withinBudget) {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        QUOTA_EXHAUSTED_REASON,
      );
      return;
    }

    const locale = resolveLocale(ctx.locale);

    // Both the prompt (targetAutomationKeys) and the matching manifest must
    // derive tag numbers from the identical testCaseId-sorted order for the
    // same target set — ctx.targets arrives in unspecified DB order.
    // buildTargetManifest is the single source of truth for that order: it
    // returns the manifest AND the targets in the exact order it numbered
    // them, so there is no separate sort to keep in sync by hand.
    const { manifest, sortedTargets } = buildTargetManifest(ctx.targets);

    const { outcome, incomplete } = await this.extractWithDeclarationRetry(
      {
        filePath: ctx.filePath,
        language: detectLanguage(ctx.filePath),
        content: source.content,
        locale,
        targetAutomationKeys: sortedTargets.map(
          (target) => target.automationKey,
        ),
        requestSuiteSummary: ctx.requestSuiteSummary,
      },
      source.content,
    );

    if (outcome.kind === 'provider-unavailable') {
      if (outcome.retryable && !ctx.isFinalAttempt) {
        throw new RetryableProviderError(outcome.reason);
      }
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        outcome.reason,
      );
      return;
    }

    if (outcome.kind === 'no-tests-found') {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        incomplete ? EXTRACTION_INCOMPLETE_REASON : NO_TESTS_FOUND_REASON,
      );
      return;
    }

    // Tag resolution runs over the raw, pre-dedupe cases array — a tag
    // citation is per-case, not per-automationKey, so a case must never be
    // dropped by a raw-key collision before its tag is read. matchRound
    // handles the key-phase's dedupe internally, over only the cases a tag
    // did not already consume.
    const firstRound = matchRound(sortedTargets, outcome.cases, manifest);

    let matched: { target: DocumentFileTarget; testCase: ExtractedCase }[] = [
      ...firstRound.matched,
    ];
    let unmatched: DocumentFileTarget[] = [...firstRound.unmatched];

    if (unmatched.length > 0) {
      // A fresh manifest, renumbered from T1 and scoped to only the
      // still-unmatched subset: a tag means a different thing in each
      // round, so round 1's and round 2's manifests/case pools must never
      // mix. Same single-source-of-truth ordering as round 1: the prompt
      // and the retry's matching manifest both come from this one call.
      const { manifest: retryManifest, sortedTargets: retrySortedTargets } =
        buildTargetManifest(unmatched);

      const retryOutcome = await this.extractor.extract({
        filePath: ctx.filePath,
        language: detectLanguage(ctx.filePath),
        content: source.content,
        locale,
        targetAutomationKeys: retrySortedTargets.map(
          (target) => target.automationKey,
        ),
        requestSuiteSummary: ctx.requestSuiteSummary,
      });

      if (retryOutcome.kind === 'extracted') {
        const retryRound = matchRound(
          retrySortedTargets,
          retryOutcome.cases,
          retryManifest,
          // Conflict-check against the FULL original target set, not just
          // this round's still-unmatched subset — a citation whose key
          // belongs to a target round 1 already matched must still be
          // caught, or it silently binds the wrong test case.
          sortedTargets,
        );

        const matchedByTestCaseId = new Map(
          [...firstRound.matched, ...retryRound.matched].map((entry) => [
            entry.target.testCaseId,
            entry,
          ]),
        );

        matched = ctx.targets
          .map((target) => matchedByTestCaseId.get(target.testCaseId))
          .filter(
            (
              entry,
            ): entry is {
              target: DocumentFileTarget;
              testCase: ExtractedCase;
            } => entry !== undefined,
          );
        unmatched = [...retryRound.unmatched];
      }
    }

    if (unmatched.length > 0) {
      this.logger.warn(
        summarizeUnmatchedTargets({
          filePath: ctx.filePath,
          matched: matched.length,
          total: ctx.targets.length,
          unmatchedKeys: unmatched.map((target) => target.automationKey),
          sourceLength: source.content.length,
          truncated: source.truncated,
        }),
      );
    }

    const unmatchedReason = unmatchedReasonFor(source.truncated);

    if (matched.length === 0) {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        unmatched,
        unmatchedReason,
      );
      return;
    }

    const notedMatched = this.applyTargetIncompleteNote(
      matched,
      ctx.targets.length,
      locale,
    );

    const persisted = await this.persistDocumentFileTargets(
      notedMatched,
      ctx,
      outcome.suite,
    );
    if (!persisted) {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        NOT_ENTITLED_REASON,
      );
      return;
    }

    if (unmatched.length > 0) {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        unmatched,
        unmatchedReason,
      );
    }
  }

  private applyTargetIncompleteNote(
    matched: { target: DocumentFileTarget; testCase: ExtractedCase }[],
    totalTargets: number,
    locale: 'es' | 'en',
  ): { target: DocumentFileTarget; testCase: ExtractedCase }[] {
    if (matched.length >= totalTargets) return matched;

    const note = incompleteTargetNote(matched.length, totalTargets, locale);

    return matched.map(({ target, testCase }) => {
      const observations = testCase.observations ?? [];
      if (observations.length >= MAX_CASE_OBSERVATIONS) {
        return { target, testCase };
      }

      return {
        target,
        testCase: { ...testCase, observations: [...observations, note] },
      };
    });
  }

  private async extractWithDeclarationRetry(
    extractInput: ExtractionInput,
    content: string,
  ): Promise<{
    outcome: ExtractionOutcome;
    incomplete: boolean;
    declarationCount: number;
  }> {
    const declarationCount = countTestDeclarations(
      content,
      extractInput.language,
    );
    const outcome = await this.extractor.extract(extractInput);

    if (outcome.kind !== 'no-tests-found' || declarationCount === 0) {
      return { outcome, incomplete: false, declarationCount };
    }

    const retried = await this.extractor.extract({
      ...extractInput,
      declarationCountHint: declarationCount,
    });

    return {
      outcome: retried,
      incomplete: retried.kind === 'no-tests-found',
      declarationCount,
    };
  }

  private applyIncompleteExtractionNote(
    cases: readonly ExtractedCase[],
    declarationCount: number,
    locale: 'es' | 'en',
  ): ExtractedCase[] {
    if (declarationCount === 0 || cases.length >= declarationCount) {
      return [...cases];
    }

    const note = incompleteExtractionNote(
      cases.length,
      declarationCount,
      locale,
    );

    return cases.map((testCase) => {
      const observations = testCase.observations ?? [];
      if (observations.length >= MAX_CASE_OBSERVATIONS) return testCase;

      return { ...testCase, observations: [...observations, note] };
    });
  }

  private async spendCreditOrFallbackForTargets(
    ctx: DocumentFileJobContext,
    targets: DocumentFileTarget[],
  ): Promise<boolean> {
    const spent = await this.entitlement.spendCredit(ctx.organizationId);
    if (!spent) {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        targets,
        NOT_ENTITLED_REASON,
      );
    }
    return spent;
  }

  private async persistDocumentFileTargets(
    matched: { target: DocumentFileTarget; testCase: ExtractedCase }[],
    ctx: DocumentFileJobContext,
    suite: ExtractedSuite | null,
  ): Promise<boolean> {
    try {
      return await this.writeDocumentFileTargets(matched, ctx, suite);
    } catch (error) {
      if (testCaseUniqueConstraint(error) === 'name') {
        this.logger.error(
          await diagnoseNameCollision(this.prisma, ctx.filePath, matched),
        );
      }
      throw error;
    }
  }

  private async writeDocumentFileTargets(
    matched: { target: DocumentFileTarget; testCase: ExtractedCase }[],
    ctx: DocumentFileJobContext,
    suite: ExtractedSuite | null,
  ): Promise<boolean> {
    const caseIds = matched.map(({ target }) => target.testCaseId);
    // Suites with a case that got a new version, reclassified after commit.
    const documentedSuiteIds = new Set<string>();

    const write = async (tx: TxClient): Promise<boolean> => {
      documentedSuiteIds.clear();

      // Lock order, shared with every other writer: the organization row
      // (spending the credit updates it), then the test_case rows. A push
      // persisting proposals spends its credit first too, so the two
      // serialize on the organization row instead of deadlocking.
      const spent = await this.entitlement.spendCredit(ctx.organizationId, tx);
      if (!spent) return false;

      await lockTestCases(tx, caseIds);

      // Read only once the lock is held, so every decision below (human
      // edit, identical redelivery) sees what the previous writer committed.
      const caseRows = await tx.testCase.findMany({
        where: { id: { in: caseIds } },
        select: {
          id: true,
          suiteId: true,
          name: true,
          documentationSource: true,
          documentationQueuedAt: true,
          currentVersion: {
            select: {
              title: true,
              objective: true,
              preconditions: true,
              steps: true,
              expectedResult: true,
              priority: true,
              locale: true,
            },
          },
        },
      });
      const caseInfoById = new Map(caseRows.map((row) => [row.id, row]));

      // The enqueue already left out cases waiting for review, but a push or
      // a document-case job can create a proposal while this job is queued.
      // Rechecked under the lock: documenting now would publish over a
      // version the reviewer is about to compare against.
      const pendingCaseIds = casesWithPendingProposal(
        await tx.extractedProposal.findMany({
          where: pendingProposalsWhere(caseIds),
          select: PENDING_PROPOSAL_CASES_SELECT,
        }),
      );

      let skippedForSupersededRun = 0;
      let skippedForHumanEdit = 0;
      let skippedForPendingProposal = 0;
      let skippedForIdenticalRedelivery = 0;
      const suiteIds = new Set<string>();

      for (const { target, testCase } of matched) {
        const info = caseInfoById.get(target.testCaseId);
        if (info === undefined) continue;

        suiteIds.add(info.suiteId);

        // The queued marker is this run's claim on the case. Whoever cleared
        // it since the job was queued owns the outcome now: an approval that
        // published its own version, or this job's own earlier attempt that
        // already committed. Nothing is written, so their outcome stands.
        // Queuing the case again sets the marker, so a deliberate re-run
        // still documents it.
        if (info.documentationQueuedAt === null) {
          skippedForSupersededRun += 1;
          continue;
        }

        if (info.documentationSource === HUMAN_DOCUMENTATION_SOURCE) {
          const humanSkipState: DocumentationStateWrite = {
            documentationOutcome: 'skipped',
            documentationSkipReason: 'human-documented',
            documentationOutcomeAt: new Date(),
            documentationQueuedAt: null,
          };
          await tx.testCase.update({
            where: { id: target.testCaseId },
            data: humanSkipState,
          });
          skippedForHumanEdit += 1;
          continue;
        }

        if (pendingCaseIds.has(target.testCaseId)) {
          const pendingSkipState: DocumentationStateWrite = {
            documentationOutcome: 'skipped',
            documentationSkipReason: 'already-pending',
            documentationOutcomeAt: new Date(),
            documentationQueuedAt: null,
          };
          await tx.testCase.update({
            where: { id: target.testCaseId },
            data: pendingSkipState,
          });
          skippedForPendingProposal += 1;
          continue;
        }

        const nextFields: PublishTestCaseVersionFields = {
          title: testCase.title,
          objective: testCase.objective,
          preconditions: [...testCase.preconditions],
          steps: [...testCase.steps],
          expectedResult: testCase.expectedResult,
          priority: testCase.priority,
          locale: ctx.locale ?? null,
        };

        if (isSameDocumentation(info.currentVersion ?? null, nextFields)) {
          await tx.testCase.update({
            where: { id: target.testCaseId },
            data: { documentationQueuedAt: null },
          });
          skippedForIdenticalRedelivery += 1;
          continue;
        }

        const assessment = assessCaseDocumentation({
          name: nextFields.title,
          automationKey: target.automationKey,
          objective: nextFields.objective,
          steps: nextFields.steps,
          expectedResult: nextFields.expectedResult,
        });

        const documentedState: DocumentationStateWrite = {
          documentationOutcome: assessment.complete ? 'complete' : 'incomplete',
          documentationMissing: assessment.missing,
          documentationOutcomeAt: new Date(),
          documentationQueuedAt: null,
          documentationSkipReason: null,
        };

        await publishWithNameFallback(
          tx,
          {
            testCaseId: target.testCaseId,
            suiteId: info.suiteId,
            automationKey: target.automationKey,
            currentName: info.name,
            fields: nextFields,
            overrides: {
              documentationSource: AERIS_DOCUMENTATION_SOURCE,
              ...documentedState,
              ...(testCase.observations === undefined
                ? {}
                : { observations: testCase.observations }),
            },
          },
          this.logger,
        );
        documentedSuiteIds.add(info.suiteId);

        await tx.extractedProposal.deleteMany({
          where: {
            targetTestCaseId: target.testCaseId,
            needsManualReview: true,
            status: 'in_review',
          },
        });
      }

      if (skippedForSupersededRun > 0) {
        this.logger.log(
          `Skipped documenting ${skippedForSupersededRun} case(s) in ${ctx.filePath}: superseded, their documentation run is no longer queued`,
        );
      }

      if (skippedForHumanEdit > 0) {
        this.logger.log(
          `Skipped documenting ${skippedForHumanEdit} case(s) in ${ctx.filePath}: a human already edited their documentation`,
        );
      }

      if (skippedForPendingProposal > 0) {
        this.logger.log(
          `Skipped documenting ${skippedForPendingProposal} case(s) in ${ctx.filePath}: a proposal for them is waiting for review`,
        );
      }

      if (skippedForIdenticalRedelivery > 0) {
        this.logger.log(
          `Skipped documenting ${skippedForIdenticalRedelivery} case(s) in ${ctx.filePath}: the current version already carries this documentation (redelivery)`,
        );
      }

      await this.applySuiteMetadata(tx, suite, [...suiteIds]);

      return true;
    };

    // A conflict rolls this transaction back whole, so only the transaction
    // runs again, in process: the extraction and the credit are not repeated.
    // When every attempt loses, the job goes back to the queue, which is safe
    // because nothing of it committed.
    const written = await retryTransientConflicts(() =>
      this.prisma.$transaction(write),
    ).catch((error: unknown) => {
      if (!isTransientTransactionConflict(error)) throw error;
      throw new RetryableTransactionConflictError(
        `documenting ${ctx.filePath}`,
        error,
      );
    });

    // New documentation changes what a waiting proposal duplicates or
    // updates, so its duplicateKind and matched case are recomputed, the same
    // way a push that writes proposals does. Only after the commit, so the
    // reclassify job reads the new versions.
    if (written) {
      for (const suiteId of documentedSuiteIds) {
        await this.reclassifier.enqueue(suiteId);
      }
    }

    return written;
  }

  private async applySuiteMetadata(
    tx: TxClient,
    suite: ExtractedSuite | null,
    suiteIds: string[],
  ): Promise<void> {
    if (suite === null || suiteIds.length !== 1) return;
    const [suiteId] = suiteIds;

    const metadata = await lockSuiteMetadata(tx, suiteId);
    if (metadata === null) return;

    if (metadata.nameSource === HUMAN_NAME_SOURCE) {
      this.logger.log(
        `Skipped applying suite metadata to ${suiteId}: a human already named this suite`,
      );
      return;
    }

    await tx.$executeRawUnsafe(`SAVEPOINT ${SUITE_METADATA_SAVEPOINT}`);

    try {
      const mergedTags = mergeSuiteTags(metadata.tags, suite.tags);
      const assessment = assessSuiteDocumentation({
        name: suite.title,
        description: suite.description,
        tags: mergedTags,
      });

      const documentedState: Omit<
        DocumentationStateWrite,
        'documentationQueuedAt'
      > = {
        documentationOutcome: assessment.complete ? 'complete' : 'incomplete',
        documentationMissing: assessment.missing,
        documentationOutcomeAt: new Date(),
        documentationSkipReason: null,
      };

      await tx.suite.update({
        where: { id: suiteId },
        data: {
          name: suite.title,
          description: suite.description,
          tags: mergedTags,
          nameSource: AERIS_NAME_SOURCE,
          ...documentedState,
        },
      });

      await tx.$executeRawUnsafe(
        `RELEASE SAVEPOINT ${SUITE_METADATA_SAVEPOINT}`,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      await tx.$executeRawUnsafe(
        `ROLLBACK TO SAVEPOINT ${SUITE_METADATA_SAVEPOINT}`,
      );
      await tx.$executeRawUnsafe(
        `RELEASE SAVEPOINT ${SUITE_METADATA_SAVEPOINT}`,
      );

      this.logger.log(
        `Skipped applying suite metadata to ${suiteId}: the proposed name collides with another suite in this project`,
      );
    }
  }

  private async runExtraction(ctx: JobContext): Promise<void> {
    try {
      await this.runExtractionUnsafe(ctx);
    } catch (error) {
      if (error instanceof RetryableProviderError) throw error;
      // Only a document-case job (the one with a target case) is retried
      // here; a code-change job keeps its own failure handling.
      if (
        ctx.targetTestCaseId !== null &&
        !ctx.isFinalAttempt &&
        isTransientTransactionConflict(error)
      ) {
        this.logger.warn(
          `Documenting case ${ctx.targetTestCaseId} lost a transaction conflict; the queue will retry it`,
        );
        throw new RetryableTransactionConflictError(
          `documenting case ${ctx.targetTestCaseId}`,
          error,
        );
      }
      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(
        `Extraction for ${ctx.filePath} failed unexpectedly: ${reason}`,
      );
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        EXTRACTION_FAILED_REASON,
      );
    }
  }

  private async runExtractionUnsafe(ctx: JobContext): Promise<void> {
    if (ctx.connection === null) {
      await this.failureRecorder.recordExtractionFailure(ctx, 'no-connection');
      return;
    }

    const entitled = await this.entitlement.isEntitled(ctx.organizationId);
    if (!entitled) {
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        NOT_ENTITLED_REASON,
      );
      return;
    }

    const { owner, repo } = splitRepo(ctx.connection.repo);
    const accessToken =
      ctx.connection.encryptedAccessToken === null
        ? undefined
        : this.encryption.decrypt(ctx.connection.encryptedAccessToken);

    const sourceLimit = await this.entitlement.maxSourceCharacters(
      ctx.organizationId,
    );
    const source = await this.sourceReader.read({
      provider: ctx.connection.provider,
      owner,
      repo,
      ref: ctx.ref,
      path: normalizeAutomationFilePath(ctx.filePath, repo),
      accessToken,
      maxContentLength: sourceLimit,
    });

    if (source.kind === 'unavailable') {
      await this.failureRecorder.recordExtractionFailure(ctx, source.reason);
      return;
    }

    if (source.truncated) {
      this.logger.warn(
        describeTruncatedSource(ctx.filePath, source.content.length),
      );
    }

    const locale = resolveLocale(ctx.locale);

    // A push re-reads every test file it touches, changed or not. When the push
    // recorded right before this one extracted exactly the same text, with the
    // same prompt, model, locale and truncation, the model has nothing new to
    // say, so the job ends before it spends the daily budget, a model call or a
    // credit. Document requests are explicit and always run.
    const fingerprint: SourceFingerprint | null =
      ctx.codeChangeId === null
        ? null
        : {
            codeChangeId: ctx.codeChangeId,
            sourceHash: fingerprintSource({
              promptVersion: EXTRACTION_PROMPT_VERSION,
              model: this.extractorIdentity(),
              locale,
              truncationLimit: source.truncated ? sourceLimit : null,
              content: source.content,
            }),
          };
    // The tests the parser reads in this file version, recorded with the stamp
    // so the next push can tell which ones changed. Null for a file it cannot
    // read (another language, a syntax error, a cut source, no test it sees).
    const declared: DeclaredFile | null =
      fingerprint === null ? null : this.readDeclarations(ctx, source);
    const comparison =
      fingerprint === null
        ? null
        : await this.skipUnchangedSource(ctx, fingerprint, declared);
    if (comparison?.skipped === true) return;

    // For a file the parser reads, only the declarations that are new or
    // changed since the baseline push go to the model, as explicit targets.
    // Every other file keeps the whole-file extraction below.
    if (fingerprint !== null && declared !== null) {
      const connection = ctx.connection;
      await this.extractChangedDeclarations(ctx, {
        fingerprint,
        declared,
        own: comparison?.own ?? null,
        previous: comparison?.previous ?? null,
        content: source.content,
        locale,
        readAt: (ref) =>
          this.sourceReader.read({
            provider: connection.provider,
            owner,
            repo,
            ref,
            path: normalizeAutomationFilePath(ctx.filePath, repo),
            accessToken,
            maxContentLength: sourceLimit,
          }),
      });
      return;
    }

    // See the equivalent guard in runDocumentFileExtractionUnsafe: don't
    // re-charge the daily budget for a retry of the same logical extraction.
    const withinBudget = ctx.isFirstAttempt
      ? await this.dailyBudget.tryConsume(NOT_BYOK)
      : true;
    if (!withinBudget) {
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        QUOTA_EXHAUSTED_REASON,
      );
      return;
    }

    const { outcome, incomplete, declarationCount } =
      await this.extractWithDeclarationRetry(
        {
          filePath: ctx.filePath,
          language: detectLanguage(ctx.filePath),
          content: source.content,
          locale,
          ...(ctx.onlyAutomationKey === null
            ? {}
            : { automationKey: ctx.onlyAutomationKey }),
        },
        source.content,
      );

    if (outcome.kind === 'provider-unavailable') {
      if (outcome.retryable && !ctx.isFinalAttempt) {
        throw new RetryableProviderError(outcome.reason);
      }
      await this.failureRecorder.recordExtractionFailure(ctx, outcome.reason);
      return;
    }

    if (outcome.kind === 'no-tests-found') {
      if (!(await this.spendCreditOrFallback(ctx))) return;

      await this.failureRecorder.recordExtractionFailure(
        ctx,
        incomplete ? EXTRACTION_INCOMPLETE_REASON : NO_TESTS_FOUND_REASON,
      );
      return;
    }

    const deduped = this.applyIncompleteExtractionNote(
      dedupeByAutomationKey(outcome.cases),
      declarationCount,
      locale,
    );
    const cases =
      ctx.onlyAutomationKey === null
        ? deduped
        : deduped.filter(
            (candidate) =>
              normalizeAutomationKey(candidate.automationKey) ===
              normalizeAutomationKey(ctx.onlyAutomationKey as string),
          );

    if (cases.length === 0) {
      if (!(await this.spendCreditOrFallback(ctx))) return;

      await this.failureRecorder.recordExtractionFailure(
        ctx,
        unmatchedReasonFor(source.truncated),
      );
      return;
    }

    const persisted = await this.proposalWriter.persistExtracted(cases, ctx);
    if (!persisted) {
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        NOT_ENTITLED_REASON,
      );
      return;
    }

    if (fingerprint === null) return;

    // A file that hit the case cap lost cases the model could not return, so
    // it must be extracted again next time instead of being taken for done.
    // The count that matters is the model's own, before duplicates are merged.
    // (A file the parser reads takes the targeted extraction, which splits its
    // tests over as many calls as it needs and applies the same cap rule per
    // call. For the rest this is the only signal that is exact: a regex count
    // of declarations overcounts.)
    if (outcome.cases.length >= MAX_EXTRACTED_CASES) {
      this.logger.log(
        `Extraction of ${ctx.filePath} reached the ${String(MAX_EXTRACTED_CASES)}-case cap: leaving it unstamped so the next push extracts it again`,
      );
      return;
    }

    // A file the parser reads never gets here, so there is no snapshot to keep.
    await this.stampExtraction(fingerprint, null);
  }

  /**
   * Reads the test declarations of a code change's file for change detection.
   * A file it cannot read is logged and goes through the whole-file
   * extraction.
   */
  private readDeclarations(
    ctx: JobContext,
    source: { content: string; truncated: boolean },
  ): DeclaredFile | null {
    const result = readDeclaredFile({
      filePath: ctx.filePath,
      content: source.content,
      truncated: source.truncated,
    });
    if (result.kind === 'declared') return result.file;

    this.logger.debug(
      `No declaration snapshot for ${ctx.filePath} at ${ctx.ref}: ${result.reason}`,
    );
    return null;
  }

  /**
   * The code-change extraction of a file the parser reads. The declarations
   * are compared with the baseline push of the file; only the new and changed
   * ones go to the model, as explicit targets (see `chunkTargets` for how many
   * per call), and every other test of the file produces nothing.
   *
   * Cost: one unit of the daily budget per model call, and one credit for each
   * save of proposals, which is once per job unless a retry finishes it. A
   * file with no change spends neither and is stamped.
   *
   * The push is stamped, with a complete snapshot, only when every target came
   * back described. Otherwise what matched is saved and the push keeps an
   * incomplete snapshot without the stamp: a retry or a redelivery of this
   * push, and the next push of the branch, send only what is still
   * undescribed.
   *
   * A retryable provider failure saves what the earlier calls matched before
   * it rethrows, so the retry resends only the rest. The unit charged for the
   * call that failed pays for the retry's first call; every later call is
   * charged. The budget therefore counts each call that answers, once.
   */
  private async extractChangedDeclarations(
    ctx: JobContext,
    job: {
      fingerprint: SourceFingerprint;
      declared: DeclaredFile;
      /** This push's own row, from the fingerprint gate. */
      own: PushStamp | null;
      /** The push it is compared with, from the fingerprint gate. */
      previous: PushStamp | null;
      content: string;
      locale: 'es' | 'en';
      readAt: (ref: string) => Promise<SourceReadResult>;
    },
  ): Promise<void> {
    // An earlier attempt at this same file version left an incomplete
    // snapshot: carry on from it, keeping what it found removed.
    const resumed =
      job.own !== null && job.own.sourceHash === job.fingerprint.sourceHash
        ? readDeclarationSnapshot(job.own.declarationSnapshot)
        : null;
    const resuming = resumed !== null && !resumed.complete;
    const baseline = resuming
      ? resumed
      : await this.resolveBaseline(ctx, job.previous, job.readAt);
    const diff = diffDeclarations(job.declared, baseline);
    const removedRefs = resuming ? resumed.removed : diff.removed;
    const total = job.declared.declarations.length;
    const removed = removedRefs?.length ?? 0;

    if (diff.changed.length === 0) {
      this.logger.log(
        `Skipped extraction of ${ctx.filePath} at ${ctx.ref}: none of its ${String(total)} test declarations changed since the previous push (${String(removed)} removed)`,
      );
      await this.stampExtraction(
        job.fingerprint,
        buildDeclarationSnapshot(job.declared, removedRefs),
      );
      return;
    }

    const chunks = chunkTargets(diff.changed);
    this.logger.log(
      `Extracting ${String(diff.changed.length)} of ${String(total)} test declarations of ${ctx.filePath} at ${ctx.ref} in ${String(chunks.length)} model call(s) (${resuming ? 'resumed' : (diff.wholeFile ?? 'changed only')}, ${String(removed)} removed)`,
    );

    const matched: ExtractedCase[] = [];
    const described = new Set<string>();
    let answered = false;
    let stopReason: string | null = null;
    let retryReason: string | null = null;
    // A retry's first call reuses the unit charged for the call that failed.
    let prepaid = ctx.isFirstAttempt ? 0 : 1;

    for (const targets of chunks) {
      const withinBudget =
        prepaid > 0 || (await this.dailyBudget.tryConsume(NOT_BYOK));
      prepaid = 0;
      if (!withinBudget) {
        stopReason = QUOTA_EXHAUSTED_REASON;
        break;
      }

      const outcome = await this.extractor.extract({
        filePath: ctx.filePath,
        language: detectLanguage(ctx.filePath),
        content: job.content,
        locale: job.locale,
        targetDeclarations: targets.map(toTargetDeclaration),
      });

      if (outcome.kind === 'provider-unavailable') {
        if (outcome.retryable && !ctx.isFinalAttempt) {
          retryReason = outcome.reason;
        } else {
          stopReason = outcome.reason;
        }
        break;
      }

      answered = true;
      const returned = outcome.kind === 'extracted' ? outcome.cases : [];
      const round = matchTargetedCases(
        targets,
        job.declared.declarations,
        returned,
        job.content,
      );
      matched.push(...round.matched.map(({ testCase }) => testCase));
      // An answer at the cap may have lost cases the extractor cut, rows of a
      // table above all: what it matched is saved, but none of its targets
      // counts as described, so the push stays unstamped.
      if (returned.length >= MAX_EXTRACTED_CASES) {
        this.logger.log(
          `A model call for ${ctx.filePath} reached the ${String(MAX_EXTRACTED_CASES)}-case cap: its ${String(targets.length)} declaration(s) count as not described`,
        );
      } else {
        for (const { target } of round.matched) described.add(target.id);
      }
      if (round.dropped > 0) {
        this.logger.log(
          `Dropped ${String(round.dropped)} case(s) of ${ctx.filePath} that describe no requested declaration`,
        );
      }
    }

    const saved = await this.saveTargetedCases(ctx, {
      matched,
      described,
      requested: diff.changed.length,
      locale: job.locale,
      // Spent once the job ends; a retry pays when it answers.
      chargeEmptyAnswer: answered && retryReason === null,
    });
    if (saved !== 'saved') described.clear();

    const undescribed = diff.changed
      .map(({ id }) => id)
      .filter((id) => !described.has(id));
    const snapshot = buildDeclarationSnapshot(
      job.declared,
      removedRefs,
      undescribed,
    );

    if (undescribed.length === 0) {
      await this.stampExtraction(job.fingerprint, snapshot);
      return;
    }

    await this.recordProgress(job.fingerprint, snapshot);

    if (retryReason !== null) throw new RetryableProviderError(retryReason);

    const reason = stopReason ?? EXTRACTION_INCOMPLETE_REASON;
    this.logger.log(
      `Extraction of ${ctx.filePath} described ${String(diff.changed.length - undescribed.length)} of ${String(diff.changed.length)} requested test declarations (${reason}): leaving it unstamped so the rest is requested again`,
    );
    if (saved === 'nothing') {
      await this.failureRecorder.recordExtractionFailure(ctx, reason);
    }
  }

  /**
   * Saves the matched cases of a targeted extraction, with the incomplete
   * note when some requested declarations did not come back. `nothing` when
   * no case matched; `refused` when the credit was refused, which is already
   * recorded.
   */
  private async saveTargetedCases(
    ctx: JobContext,
    result: {
      matched: readonly ExtractedCase[];
      described: ReadonlySet<string>;
      requested: number;
      locale: 'es' | 'en';
      chargeEmptyAnswer: boolean;
    },
  ): Promise<'saved' | 'nothing' | 'refused'> {
    if (result.matched.length === 0) {
      // A call that answered was paid for even when nothing in it was usable.
      if (
        result.chargeEmptyAnswer &&
        !(await this.spendCreditOrFallback(ctx))
      ) {
        return 'refused';
      }
      return 'nothing';
    }

    const cases = dedupeByAutomationKey(
      result.described.size === result.requested
        ? result.matched
        : withIncompleteTargetNote(
            result.matched,
            result.described.size,
            result.requested,
            result.locale,
          ),
    );

    const persisted = await this.proposalWriter.persistExtracted(cases, ctx);
    if (!persisted) {
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        NOT_ENTITLED_REASON,
      );
      return 'refused';
    }
    return 'saved';
  }

  /**
   * Records an incomplete snapshot on the push and clears its stamp, so the
   * fingerprint gate treats it as not extracted even when a stamp from an
   * earlier run of the same hash is still there. Written with the hash it
   * belongs to. A failure here only costs the next attempt or push the
   * requests it could have avoided.
   */
  private async recordProgress(
    fingerprint: SourceFingerprint,
    snapshot: DeclarationSnapshot,
  ): Promise<void> {
    try {
      await this.prisma.codeChange.updateMany({
        where: { id: fingerprint.codeChangeId },
        data: {
          sourceHash: fingerprint.sourceHash,
          extractedAt: null,
          declarationSnapshot: snapshotColumn(snapshot),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record the progress of code change ${fingerprint.codeChangeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * The declarations of the file at the push it is compared with (see
   * `findBaselinePush`), or null, so every declaration counts as changed:
   *
   * - no such push, or the lookup failed;
   * - that push is not stamped and left no incomplete snapshot (in flight);
   *   an incomplete snapshot is a baseline whose undescribed declarations
   *   count as changed;
   * - it is stamped without a snapshot (extracted before snapshots existed, or
   *   through the whole-file path) and its file cannot be rebuilt safely: the
   *   file is read again at its commit and parsed, one extra read, but only
   *   when the read is complete and no shorter than any plan limit could have
   *   cut it. A longer file may have been extracted cut under another limit,
   *   so the tests past that cut were never described.
   */
  private async resolveBaseline(
    ctx: JobContext,
    previous: PushStamp | null,
    readAt: (ref: string) => Promise<SourceReadResult>,
  ): Promise<DeclaredFile | null> {
    if (previous === null) return null;

    const stored = readDeclarationSnapshot(previous.declarationSnapshot);
    if (previous.extractedAt === null) {
      return stored !== null && !stored.complete ? stored : null;
    }
    if (stored !== null) return stored;

    try {
      const source = await readAt(previous.commitSha);
      if (source.kind === 'unavailable') {
        this.logger.warn(
          `Could not read ${ctx.filePath} at ${previous.commitSha} to compare its tests, extracting every one: ${source.reason}`,
        );
        return null;
      }

      if (source.content.length >= SMALLEST_PLAN_SOURCE_LIMIT) {
        this.logger.log(
          `Not comparing ${ctx.filePath} with ${previous.commitSha}: a file of ${String(source.content.length)} characters may have been extracted cut, extracting every test`,
        );
        return null;
      }

      const result = readDeclaredFile({
        filePath: ctx.filePath,
        content: source.content,
        truncated: source.truncated,
      });
      return result.kind === 'declared' ? result.file : null;
    } catch (error) {
      this.logger.warn(
        `Could not rebuild the baseline of ${ctx.filePath}, extracting every test: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Ends a code-change job whose file is identical to what the push it is
   * compared with (see `findBaselinePush`) extracted, under the same prompt,
   * model, locale and truncation.
   *
   * Never "the newest extraction overall": pushes persist out of order, so a
   * revert (A, B, A) must not be matched with the first A while B is still in
   * flight or in its retry backoff. That push holds its hash but no
   * `extractedAt`, which is enough to stop the skip. Comparing by `createdAt`,
   * which the database wrote, also keeps the order off the worker clocks.
   *
   * A skipped push is stamped as extracted too, because its proposals are
   * exactly those of the push it matched. A job delivered again after its own
   * extraction finished finds its own stamp and ends without writing.
   *
   * The check never blocks an extraction. If the lookup or the write fails,
   * the job carries on and pays for the call it could have skipped, with no
   * push to compare its tests with.
   *
   * The declaration snapshot moves with the stamp: a skipped push records the
   * declarations it holds, with nothing removed since the identical push it
   * matched, and a cleared stamp clears its snapshot too.
   */
  private async skipUnchangedSource(
    ctx: JobContext,
    fingerprint: SourceFingerprint,
    declared: DeclaredFile | null,
  ): Promise<PushComparison> {
    const { codeChangeId, sourceHash } = fingerprint;

    try {
      const { own, previous } = await this.findPreviousPush(ctx, codeChangeId);

      if (
        own !== null &&
        own.extractedAt !== null &&
        own.sourceHash === sourceHash
      ) {
        this.logger.log(
          `Skipped extraction of ${ctx.filePath} at ${ctx.ref}: this push was already extracted`,
        );
        return { skipped: true, own, previous };
      }

      if (
        previous !== null &&
        previous.extractedAt !== null &&
        previous.sourceHash === sourceHash
      ) {
        await this.prisma.codeChange.updateMany({
          where: { id: codeChangeId },
          data: {
            sourceHash,
            extractedAt: new Date(),
            declarationSnapshot: snapshotColumn(
              declared === null ? null : buildDeclarationSnapshot(declared, []),
            ),
          },
        });
        this.logger.log(
          `Skipped extraction of ${ctx.filePath} at ${ctx.ref}: unchanged since the previous push`,
        );
        return { skipped: true, own, previous };
      }

      // The stamp goes with the old hash. A push delivered again under another
      // prompt, model, locale or limit would otherwise keep it next to the new
      // hash even if this extraction fails, finds nothing or hits the cap, and
      // the next identical push would skip a version never extracted. A row
      // that already holds this hash, unstamped, is a retry or a redelivery of
      // this same version: its incomplete snapshot stays, for it to resume.
      if (own?.sourceHash !== sourceHash) {
        await this.prisma.codeChange.updateMany({
          where: { id: codeChangeId },
          data: {
            sourceHash,
            extractedAt: null,
            declarationSnapshot: Prisma.DbNull,
          },
        });
      }
      return { skipped: false, own, previous };
    } catch (error) {
      this.logger.warn(
        `Could not compare ${ctx.filePath} with its last extraction, extracting anyway: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { skipped: false, own: null, previous: null };
    }
  }

  /** This push's own row and the push it is compared with. */
  private async findPreviousPush(
    ctx: JobContext,
    codeChangeId: string,
  ): Promise<{ own: PushStamp | null; previous: PushStamp | null }> {
    const own = await this.prisma.codeChange.findFirst({
      where: { id: codeChangeId },
      select: PUSH_STAMP_SELECT,
    });

    return { own, previous: await this.findBaselinePush(ctx, codeChangeId) };
  }

  /**
   * The push a code change of the file is compared with, by the fingerprint
   * gate and by change detection alike. Order is `createdAt`, then `id`,
   * strictly before this push.
   *
   * 1. The previous push of the same branch, stamped or not. Pushes to a branch
   *    other than the default one are recorded but only extracted when the
   *    default branch is unknown, so the push right before a merge is usually
   *    an unstamped branch push; comparing within the branch skips it. A push
   *    of the same branch that is in flight or failed still counts, and stops
   *    a skip, which is what keeps a revert (A, B, A) visible.
   * 2. When the branch has no earlier push of the file (a new or renamed
   *    branch), or the push has no known branch: the latest stamped push of
   *    the file on any branch.
   *
   * None when the job does not know when its push was recorded.
   */
  private async findBaselinePush(
    ctx: JobContext,
    codeChangeId: string,
  ): Promise<PushStamp | null> {
    const createdAt = ctx.codeChangeCreatedAt;
    if (createdAt === undefined) return null;

    const earlier = {
      projectId: ctx.projectId,
      filePath: ctx.filePath,
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: codeChangeId } },
      ],
    };
    const branch = ctx.codeChangeBranch ?? null;

    if (branch !== null) {
      const sameBranch = await this.prisma.codeChange.findFirst({
        where: { ...earlier, batch: { scmEvent: { branch } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: PUSH_STAMP_SELECT,
      });
      if (sameBranch !== null) return sameBranch;
    }

    return this.prisma.codeChange.findFirst({
      where: { ...earlier, extractedAt: { not: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: PUSH_STAMP_SELECT,
    });
  }

  /**
   * What answers, for the fingerprint. The class name stands in for the model
   * when the bound extractor is not the Gemini one (disabled, or a fake), so a
   * swap of extractor re-extracts too.
   */
  private extractorIdentity(): string {
    return `${this.extractor.constructor.name}:${this.env.GEMINI_MODEL}`;
  }

  /**
   * Marks the file version as extracted, once its proposals are saved. Written
   * with the hash and the declaration snapshot so a row never carries one
   * without the others; a null snapshot clears any older one. The proposals
   * are already committed, so a failure here only costs the next identical push
   * one repeated extraction and must not fail, and so retry, the job.
   */
  private async stampExtraction(
    fingerprint: SourceFingerprint,
    snapshot: DeclarationSnapshot | null,
  ): Promise<void> {
    try {
      await this.prisma.codeChange.updateMany({
        where: { id: fingerprint.codeChangeId },
        data: {
          sourceHash: fingerprint.sourceHash,
          extractedAt: new Date(),
          declarationSnapshot: snapshotColumn(snapshot),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record the extraction of code change ${fingerprint.codeChangeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async spendCreditOrFallback(ctx: JobContext): Promise<boolean> {
    const spent = await this.entitlement.spendCredit(ctx.organizationId);
    if (!spent) {
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        NOT_ENTITLED_REASON,
      );
    }
    return spent;
  }
}
