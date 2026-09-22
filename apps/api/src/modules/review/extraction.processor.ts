import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import {
  assessCaseDocumentation,
  assessSuiteDocumentation,
  type RepoConnectionProvider,
} from '@qably/types';
import { assertNever } from '../../common/assert-never';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import { TEST_CASE_EXTRACTOR } from '../ai/ai.tokens';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import type {
  ExtractedCase,
  ExtractedSuite,
  ExtractionInput,
  ExtractionOutcome,
  TestCaseExtractor,
} from '../ai/extraction.contracts';
import { countTestDeclarations } from '../ai/count-test-declarations';
import { buildBlobUrl, SourceReader } from '../repository/source-reader';
import { splitRepo } from '../repository/lib/split-repo';
import { TestFileLocator } from '../repository/test-file-locator';
import { detectLanguage } from './lib/detect-language';
import {
  isSameDocumentation,
  publishTestCaseVersion,
  type DocumentationStateWrite,
  type PublishTestCaseVersionFields,
  type PublishTestCaseVersionTx,
} from './lib/publish-test-case-version';
import { normalizeAutomationKey } from './lib/normalize-automation-key';
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

const MAX_FALLBACK_OBJECTIVE_LENGTH = 500;
const MAX_CASE_OBSERVATIONS = 5;
const HEAD_REF = 'HEAD';
const NOT_ENTITLED_REASON = 'ai-not-enabled';
const NO_MATCHING_CASE_REASON = 'automation-key-not-found';
const NO_TESTS_FOUND_REASON = 'no-tests-found';
const EXTRACTION_INCOMPLETE_REASON = 'extraction-incomplete';
const EXTRACTION_FAILED_REASON = 'extraction-failed';
const QUOTA_EXHAUSTED_REASON = 'quota-exhausted';
const NOT_BYOK = { isByok: false };
const UNIQUE_VIOLATION = 'P2002';
const LOCK_DURATION_MS = 120_000;
const HUMAN_DOCUMENTATION_SOURCE = 'human';
const AERIS_DOCUMENTATION_SOURCE = 'aeris';
const HUMAN_NAME_SOURCE = 'human';
const AERIS_NAME_SOURCE = 'aeris';
const SUITE_METADATA_SAVEPOINT = 'suite_metadata';
const SUITE_SUMMARY_SAVEPOINT = 'suite_summary_metadata';
const SUITE_SUMMARY_MAX_CASES = 60;
const SUITE_TAG_CAP = 20;
const SUITE_STATES_FOR_SUMMARY = ['active', 'draft'] as const;

interface ConnectionInfo {
  provider: RepoConnectionProvider;
  repo: string;
  encryptedAccessToken: string | null;
}

/**
 * Marks a provider failure that's worth a real BullMQ retry (with backoff)
 * instead of an immediate manual-review fallback. Thrown only when the
 * extractor reported the failure as retryable AND this isn't the job's last
 * allowed attempt — the outer catch in runExtraction/runDocumentFileExtraction
 * rethrows it so it reaches the queue instead of being swallowed.
 */
class RetryableProviderError extends Error {
  constructor(reason: string) {
    super(`provider-unavailable:${reason}`);
    this.name = 'RetryableProviderError';
  }
}

interface JobContext {
  projectId: string;
  organizationId: string;
  filePath: string;
  ref: string;
  connection: ConnectionInfo | null;
  codeChangeId: string | null;
  targetTestCaseId: string | null;
  knownSuiteId: string | null;
  onlyAutomationKey: string | null;
  fallbackEvidenceId: string | null;
  locale: string | undefined;
  /** True when BullMQ won't retry this job again after this attempt. */
  isFinalAttempt: boolean;
  /** True on the job's first execution — a retry means budget was already spent once for this logical extraction. */
  isFirstAttempt: boolean;
}

interface DocumentFileJobContext {
  projectId: string;
  organizationId: string;
  filePath: string;
  ref: string;
  connection: ConnectionInfo | null;
  targets: DocumentFileTarget[];
  locale: string | undefined;
  /** True when BullMQ won't retry this job again after this attempt. */
  isFinalAttempt: boolean;
  /** True on the job's first execution — a retry means budget was already spent once for this logical extraction. */
  isFirstAttempt: boolean;
}

interface ExistingProposal {
  id: string;
  status: string;
  evidenceId: string;
}

interface SharedProposalFields {
  projectId: string;
  suiteId: string | null;
  status: 'in_review';
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: ExtractedCase['priority'];
  promptVersion: string;
}

interface TxClient extends PublishTestCaseVersionTx {
  suite: {
    findFirst: PrismaService['suite']['findFirst'];
    update: PrismaService['suite']['update'];
    updateMany: PrismaService['suite']['updateMany'];
  };
  testCase: {
    findFirst: PrismaService['testCase']['findFirst'];
    findMany: PrismaService['testCase']['findMany'];
    update: PrismaService['testCase']['update'];
  };
  evidence: {
    create: PrismaService['evidence']['create'];
    update: PrismaService['evidence']['update'];
  };
  extractedProposal: {
    findFirst: PrismaService['extractedProposal']['findFirst'];
    findMany: PrismaService['extractedProposal']['findMany'];
    create: PrismaService['extractedProposal']['create'];
    update: PrismaService['extractedProposal']['update'];
  };
  organization: { updateMany: PrismaService['organization']['updateMany'] };
  $executeRawUnsafe: PrismaService['$executeRawUnsafe'];
  $queryRawUnsafe: PrismaService['$queryRawUnsafe'];
}

const PROPOSAL_SAVEPOINT = 'extraction_proposal';

async function lockTestCases(tx: TxClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  await tx.$executeRawUnsafe(
    `SELECT id FROM "test_case" WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function dedupeByAutomationKey(
  cases: readonly ExtractedCase[],
): ExtractedCase[] {
  const seen = new Set<string>();
  const deduped: ExtractedCase[] = [];

  for (const testCase of cases) {
    if (seen.has(testCase.automationKey)) continue;
    seen.add(testCase.automationKey);
    deduped.push(testCase);
  }

  return deduped;
}

@Processor(EXTRACTION_QUEUE, {
  concurrency: 2,
  lockDuration: LOCK_DURATION_MS,
})
export class ExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceReader: SourceReader,
    @Inject(TEST_CASE_EXTRACTOR) private readonly extractor: TestCaseExtractor,
    private readonly encryption: EncryptionService,
    private readonly entitlement: AiEntitlementService,
    private readonly dailyBudget: AiDailyBudget,
    private readonly testFileLocator: TestFileLocator,
  ) {
    super();
  }

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

    await this.runExtraction({
      projectId: codeChange.projectId,
      organizationId: codeChange.project.organizationId,
      filePath: codeChange.filePath,
      ref: codeChange.commitSha,
      connection: codeChange.project.connection,
      codeChangeId: codeChange.id,
      targetTestCaseId: null,
      knownSuiteId: null,
      onlyAutomationKey: null,
      fallbackEvidenceId: codeChange.evidenceId,
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
      fallbackEvidenceId: null,
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
    return this.prisma.$transaction(async (tx: TxClient) => {
      const locked = await lockSuiteForSummary(tx, suiteId);
      if (locked === null) return true;
      if (locked.documentationQueuedAt === null) return true;

      const spent = await this.entitlement.spendCredit(organizationId, tx);
      if (!spent) return false;

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
      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(
        `Document-file extraction for ${ctx.filePath} failed unexpectedly: ${reason}`,
      );
      await this.fallbackForTargets(ctx, ctx.targets, EXTRACTION_FAILED_REASON);
    }
  }

  private async runDocumentFileExtractionUnsafe(
    ctx: DocumentFileJobContext,
  ): Promise<void> {
    if (ctx.connection === null) {
      await this.fallbackForTargets(ctx, ctx.targets, 'no-connection');
      return;
    }

    const entitled = await this.entitlement.isEntitled(ctx.organizationId);
    if (!entitled) {
      await this.fallbackForTargets(ctx, ctx.targets, NOT_ENTITLED_REASON);
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
      path: ctx.filePath,
      accessToken,
    });

    if (source.kind === 'unavailable') {
      await this.fallbackForTargets(ctx, ctx.targets, source.reason);
      return;
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
      await this.fallbackForTargets(ctx, ctx.targets, QUOTA_EXHAUSTED_REASON);
      return;
    }

    const locale = resolveLocale(ctx.locale);

    const { outcome, incomplete, declarationCount } =
      await this.extractWithDeclarationRetry(
        {
          filePath: ctx.filePath,
          language: detectLanguage(ctx.filePath),
          content: source.content,
          locale,
          targetAutomationKeys: ctx.targets.map(
            (target) => target.automationKey,
          ),
        },
        source.content,
      );

    if (outcome.kind === 'provider-unavailable') {
      if (outcome.retryable && !ctx.isFinalAttempt) {
        throw new RetryableProviderError(outcome.reason);
      }
      await this.fallbackForTargets(ctx, ctx.targets, outcome.reason);
      return;
    }

    if (outcome.kind === 'no-tests-found') {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.fallbackForTargets(
        ctx,
        ctx.targets,
        incomplete ? EXTRACTION_INCOMPLETE_REASON : NO_TESTS_FOUND_REASON,
        incomplete
          ? [incompleteExtractionNote(0, declarationCount, locale)]
          : undefined,
      );
      return;
    }

    const byAutomationKey = new Map(
      dedupeByAutomationKey(outcome.cases).map((testCase) => [
        normalizeAutomationKey(testCase.automationKey),
        testCase,
      ]),
    );

    let { matched, unmatched } = this.matchTargets(
      ctx.targets,
      byAutomationKey,
    );

    if (unmatched.length > 0) {
      const retryOutcome = await this.extractor.extract({
        filePath: ctx.filePath,
        language: detectLanguage(ctx.filePath),
        content: source.content,
        locale,
        targetAutomationKeys: unmatched.map((target) => target.automationKey),
      });

      if (retryOutcome.kind === 'extracted') {
        for (const testCase of dedupeByAutomationKey(retryOutcome.cases)) {
          const key = normalizeAutomationKey(testCase.automationKey);
          if (!byAutomationKey.has(key)) byAutomationKey.set(key, testCase);
        }

        ({ matched, unmatched } = this.matchTargets(
          ctx.targets,
          byAutomationKey,
        ));
      }
    }

    if (matched.length === 0) {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.fallbackForTargets(ctx, unmatched, NO_MATCHING_CASE_REASON);
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
      await this.fallbackForTargets(ctx, ctx.targets, NOT_ENTITLED_REASON);
      return;
    }

    if (unmatched.length > 0) {
      await this.fallbackForTargets(ctx, unmatched, NO_MATCHING_CASE_REASON);
    }
  }

  private matchTargets(
    targets: readonly DocumentFileTarget[],
    byAutomationKey: ReadonlyMap<string, ExtractedCase>,
  ): {
    matched: { target: DocumentFileTarget; testCase: ExtractedCase }[];
    unmatched: DocumentFileTarget[];
  } {
    const matched: { target: DocumentFileTarget; testCase: ExtractedCase }[] =
      [];
    const unmatched: DocumentFileTarget[] = [];

    for (const target of targets) {
      const testCase = byAutomationKey.get(
        normalizeAutomationKey(target.automationKey),
      );
      if (testCase === undefined) {
        unmatched.push(target);
      } else {
        matched.push({ target, testCase });
      }
    }

    return { matched, unmatched };
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
      await this.fallbackForTargets(ctx, targets, NOT_ENTITLED_REASON);
    }
    return spent;
  }

  private async persistDocumentFileTargets(
    matched: { target: DocumentFileTarget; testCase: ExtractedCase }[],
    ctx: DocumentFileJobContext,
    suite: ExtractedSuite | null,
  ): Promise<boolean> {
    const caseRows = await this.prisma.testCase.findMany({
      where: { id: { in: matched.map(({ target }) => target.testCaseId) } },
      select: {
        id: true,
        suiteId: true,
        documentationSource: true,
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

    return this.prisma.$transaction(async (tx: TxClient) => {
      await lockTestCases(
        tx,
        matched.map(({ target }) => target.testCaseId),
      );

      const spent = await this.entitlement.spendCredit(ctx.organizationId, tx);
      if (!spent) return false;

      let skippedForHumanEdit = 0;
      let skippedForIdenticalRedelivery = 0;
      const suiteIds = new Set<string>();

      for (const { target, testCase } of matched) {
        const info = caseInfoById.get(target.testCaseId);
        if (info === undefined) continue;

        suiteIds.add(info.suiteId);

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

        await publishTestCaseVersion(tx, target.testCaseId, nextFields, {
          documentationSource: AERIS_DOCUMENTATION_SOURCE,
          ...documentedState,
          ...(testCase.observations === undefined
            ? {}
            : { observations: testCase.observations }),
        });
      }

      if (skippedForHumanEdit > 0) {
        this.logger.log(
          `Skipped documenting ${skippedForHumanEdit} case(s) in ${ctx.filePath}: a human already edited their documentation`,
        );
      }

      if (skippedForIdenticalRedelivery > 0) {
        this.logger.log(
          `Skipped documenting ${skippedForIdenticalRedelivery} case(s) in ${ctx.filePath}: the current version already carries this documentation (redelivery)`,
        );
      }

      await this.applySuiteMetadata(tx, suite, [...suiteIds]);

      return true;
    });
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

  private async fallbackForTargets(
    ctx: DocumentFileJobContext,
    targets: readonly DocumentFileTarget[],
    reason: string,
    observations?: string[],
  ): Promise<void> {
    if (targets.length > 0) {
      const failedState: DocumentationStateWrite = {
        documentationOutcome: 'failed',
        documentationSkipReason: reason,
        documentationOutcomeAt: new Date(),
        documentationQueuedAt: null,
      };

      await this.prisma.testCase.updateMany({
        where: {
          id: { in: targets.map((target) => target.testCaseId) },
          documentationSource: { not: HUMAN_DOCUMENTATION_SOURCE },
          documentationQueuedAt: { not: null },
        },
        data: failedState,
      });
    }

    for (const target of targets) {
      await this.persistManualReviewFallback(
        {
          projectId: ctx.projectId,
          organizationId: ctx.organizationId,
          filePath: ctx.filePath,
          ref: ctx.ref,
          connection: ctx.connection,
          codeChangeId: null,
          targetTestCaseId: target.testCaseId,
          knownSuiteId: null,
          onlyAutomationKey: target.automationKey,
          fallbackEvidenceId: null,
          locale: ctx.locale,
          isFinalAttempt: ctx.isFinalAttempt,
          isFirstAttempt: ctx.isFirstAttempt,
        },
        reason,
        observations,
      );
    }
  }

  private async runExtraction(ctx: JobContext): Promise<void> {
    try {
      await this.runExtractionUnsafe(ctx);
    } catch (error) {
      if (error instanceof RetryableProviderError) throw error;
      const reason = error instanceof Error ? error.message : 'unknown-error';
      this.logger.error(
        `Extraction for ${ctx.filePath} failed unexpectedly: ${reason}`,
      );
      await this.persistManualReviewFallback(ctx, EXTRACTION_FAILED_REASON);
    }
  }

  private async runExtractionUnsafe(ctx: JobContext): Promise<void> {
    if (ctx.connection === null) {
      await this.persistManualReviewFallback(ctx, 'no-connection');
      return;
    }

    const entitled = await this.entitlement.isEntitled(ctx.organizationId);
    if (!entitled) {
      await this.persistManualReviewFallback(ctx, NOT_ENTITLED_REASON);
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
      path: ctx.filePath,
      accessToken,
    });

    if (source.kind === 'unavailable') {
      await this.persistManualReviewFallback(ctx, source.reason);
      return;
    }

    // See the equivalent guard in runDocumentFileExtractionUnsafe: don't
    // re-charge the daily budget for a retry of the same logical extraction.
    const withinBudget = ctx.isFirstAttempt
      ? await this.dailyBudget.tryConsume(NOT_BYOK)
      : true;
    if (!withinBudget) {
      await this.persistManualReviewFallback(ctx, QUOTA_EXHAUSTED_REASON);
      return;
    }

    const locale = resolveLocale(ctx.locale);

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
      await this.persistManualReviewFallback(ctx, outcome.reason);
      return;
    }

    if (outcome.kind === 'no-tests-found') {
      if (!(await this.spendCreditOrFallback(ctx))) return;

      if (ctx.targetTestCaseId !== null) {
        await this.persistManualReviewFallback(
          ctx,
          incomplete ? EXTRACTION_INCOMPLETE_REASON : NO_TESTS_FOUND_REASON,
          incomplete
            ? [incompleteExtractionNote(0, declarationCount, locale)]
            : undefined,
        );
        return;
      }
      this.logger.log(
        incomplete
          ? `Aeris found ${declarationCount} test declaration(s) in ${ctx.filePath} but could not extract them`
          : `No tests found in ${ctx.filePath}`,
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

      if (ctx.targetTestCaseId !== null) {
        await this.persistManualReviewFallback(ctx, NO_MATCHING_CASE_REASON);
        return;
      }
      this.logger.log(
        `Extraction for ${ctx.filePath} did not include the requested case`,
      );
      return;
    }

    const persisted = await this.persistExtracted(cases, ctx);
    if (!persisted) {
      await this.persistManualReviewFallback(ctx, NOT_ENTITLED_REASON);
    }
  }

  private async spendCreditOrFallback(ctx: JobContext): Promise<boolean> {
    const spent = await this.entitlement.spendCredit(ctx.organizationId);
    if (!spent) {
      await this.persistManualReviewFallback(ctx, NOT_ENTITLED_REASON);
    }
    return spent;
  }

  private async persistExtracted(
    cases: readonly ExtractedCase[],
    ctx: JobContext,
  ): Promise<boolean> {
    const connection = ctx.connection as ConnectionInfo;
    const automationKeys = cases.map((testCase) => testCase.automationKey);

    return this.prisma.$transaction(async (tx: TxClient) => {
      const spent = await this.entitlement.spendCredit(ctx.organizationId, tx);
      if (!spent) return false;

      if (ctx.targetTestCaseId !== null) {
        const pending = await tx.extractedProposal.findFirst({
          where: {
            targetTestCaseId: ctx.targetTestCaseId,
            status: 'in_review',
          },
          select: { id: true },
        });

        if (pending !== null) return true;
      }

      const suiteId =
        ctx.knownSuiteId ??
        (await this.resolveSuiteId(tx, ctx.projectId, ctx.filePath));

      const matchedCaseByKey =
        ctx.targetTestCaseId !== null || suiteId === null
          ? new Map<string, string>()
          : await this.matchCasesByAutomationKey(tx, suiteId, automationKeys);

      const existingProposalByKey =
        ctx.codeChangeId === null
          ? new Map<string, ExistingProposal>()
          : await this.findExistingProposalsByKey(
              tx,
              ctx.codeChangeId,
              automationKeys,
            );

      for (const testCase of cases) {
        const matchedCaseId =
          ctx.targetTestCaseId ??
          matchedCaseByKey.get(testCase.automationKey) ??
          null;

        const uri = buildBlobUrl(
          connection.provider,
          connection.repo,
          ctx.ref,
          ctx.filePath,
        );

        const shared = {
          projectId: ctx.projectId,
          suiteId,
          status: 'in_review' as const,
          title: testCase.title,
          objective: testCase.objective,
          preconditions: [...testCase.preconditions],
          steps: [...testCase.steps],
          expectedResult: testCase.expectedResult,
          priority: testCase.priority,
          promptVersion: EXTRACTION_PROMPT_VERSION,
          locale: ctx.locale ?? null,
          ...(testCase.observations === undefined
            ? {}
            : { observations: testCase.observations }),
        };

        if (ctx.codeChangeId !== null) {
          await this.upsertCodeChangeProposal(
            tx,
            ctx,
            testCase,
            existingProposalByKey.get(testCase.automationKey) ?? null,
            matchedCaseId,
            uri,
            shared,
          );
          continue;
        }

        const evidence = await tx.evidence.create({
          data: {
            projectId: ctx.projectId,
            kind: 'SOURCE_EXCERPT',
            title: ctx.filePath,
            uri,
            excerpt: testCase.sourceExcerpt,
          },
          select: { id: true },
        });

        await tx.extractedProposal.create({
          data: {
            ...shared,
            evidenceId: evidence.id,
            codeChangeId: null,
            automationKey: testCase.automationKey,
            targetTestCaseId: ctx.targetTestCaseId,
          },
        });
      }

      return true;
    });
  }

  private async matchCasesByAutomationKey(
    tx: TxClient,
    suiteId: string,
    automationKeys: readonly string[],
  ): Promise<Map<string, string>> {
    const rows = (await tx.testCase.findMany({
      where: { suiteId, automationKey: { in: [...automationKeys] } },
      select: { id: true, automationKey: true },
    })) as { id: string; automationKey: string | null }[];

    return new Map(
      rows
        .filter(
          (row): row is { id: string; automationKey: string } =>
            row.automationKey !== null,
        )
        .map((row) => [row.automationKey, row.id]),
    );
  }

  private async findExistingProposalsByKey(
    tx: TxClient,
    codeChangeId: string,
    automationKeys: readonly string[],
  ): Promise<Map<string, ExistingProposal>> {
    const rows = (await tx.extractedProposal.findMany({
      where: { codeChangeId, automationKey: { in: [...automationKeys] } },
      select: { id: true, status: true, evidenceId: true, automationKey: true },
    })) as (ExistingProposal & { automationKey: string | null })[];

    return new Map(
      rows
        .filter(
          (row): row is ExistingProposal & { automationKey: string } =>
            row.automationKey !== null,
        )
        .map((row) => [row.automationKey, row]),
    );
  }

  private async upsertCodeChangeProposal(
    tx: TxClient,
    ctx: JobContext,
    testCase: ExtractedCase,
    existing: ExistingProposal | null,
    matchedCaseId: string | null,
    uri: string,
    shared: SharedProposalFields,
  ): Promise<void> {
    if (existing !== null) {
      await this.applyDecidedProposalGuard(
        tx,
        ctx,
        testCase,
        existing,
        matchedCaseId,
        uri,
        shared,
      );
      return;
    }

    await tx.$executeRawUnsafe(`SAVEPOINT ${PROPOSAL_SAVEPOINT}`);

    const evidence = await tx.evidence.create({
      data: {
        projectId: ctx.projectId,
        kind: 'SOURCE_EXCERPT',
        title: ctx.filePath,
        uri,
        excerpt: testCase.sourceExcerpt,
      },
      select: { id: true },
    });

    try {
      await tx.extractedProposal.create({
        data: {
          ...shared,
          evidenceId: evidence.id,
          codeChangeId: ctx.codeChangeId,
          automationKey: testCase.automationKey,
          targetTestCaseId: matchedCaseId,
        },
      });

      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${PROPOSAL_SAVEPOINT}`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${PROPOSAL_SAVEPOINT}`);
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${PROPOSAL_SAVEPOINT}`);

      const winner = await tx.extractedProposal.findFirst({
        where: {
          codeChangeId: ctx.codeChangeId,
          automationKey: testCase.automationKey,
        },
        select: { id: true, status: true, evidenceId: true },
      });

      if (winner === null) throw error;

      await this.applyDecidedProposalGuard(
        tx,
        ctx,
        testCase,
        winner,
        matchedCaseId,
        uri,
        shared,
      );
    }
  }

  private async applyDecidedProposalGuard(
    tx: TxClient,
    ctx: JobContext,
    testCase: ExtractedCase,
    existing: ExistingProposal,
    matchedCaseId: string | null,
    uri: string,
    shared: SharedProposalFields,
  ): Promise<void> {
    if (existing.status !== 'in_review') {
      this.logger.log(
        `Skipping redelivered extraction for already-decided proposal ${existing.id}`,
      );
      return;
    }

    await tx.evidence.update({
      where: { id: existing.evidenceId },
      data: { title: ctx.filePath, uri, excerpt: testCase.sourceExcerpt },
    });

    await tx.extractedProposal.update({
      where: { id: existing.id },
      data: { ...shared, targetTestCaseId: matchedCaseId },
    });
  }

  private async resolveSuiteId(
    tx: TxClient,
    projectId: string,
    filePath: string,
  ): Promise<string | null> {
    const byAutomationPath = await tx.testCase.findFirst({
      where: { projectId, automationFilePath: filePath },
      select: { suiteId: true },
    });

    if (byAutomationPath !== null) return byAutomationPath.suiteId;

    const byFileName = await tx.suite.findFirst({
      where: { projectId, name: filePath },
      select: { id: true },
    });

    if (byFileName !== null) return byFileName.id;

    const defaultSuite = await tx.suite.findFirst({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    return defaultSuite?.id ?? null;
  }

  private async persistManualReviewFallback(
    ctx: JobContext,
    reason: string,
    observations?: string[],
  ): Promise<void> {
    const existing =
      ctx.codeChangeId !== null
        ? await this.prisma.extractedProposal.findFirst({
            where: { codeChangeId: ctx.codeChangeId, automationKey: null },
            select: { id: true },
          })
        : await this.prisma.extractedProposal.findFirst({
            where: {
              targetTestCaseId: ctx.targetTestCaseId,
              status: 'in_review',
            },
            select: { id: true },
          });

    if (existing !== null) {
      this.logger.log(
        `Manual-review fallback already pending for ${ctx.filePath}`,
      );
      return;
    }

    const evidenceId =
      ctx.fallbackEvidenceId ?? (await this.createFallbackEvidence(ctx));

    await this.prisma.extractedProposal.create({
      data: {
        projectId: ctx.projectId,
        evidenceId,
        codeChangeId: ctx.codeChangeId,
        targetTestCaseId: ctx.targetTestCaseId,
        status: 'in_review',
        title: ctx.filePath,
        objective: reason.slice(0, MAX_FALLBACK_OBJECTIVE_LENGTH),
        needsManualReview: true,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        locale: ctx.locale ?? null,
        ...(observations === undefined || observations.length === 0
          ? {}
          : { observations }),
      },
    });
  }

  private async createFallbackEvidence(ctx: JobContext): Promise<string> {
    const uri =
      ctx.connection === null
        ? ctx.filePath
        : buildBlobUrl(
            ctx.connection.provider,
            ctx.connection.repo,
            ctx.ref,
            ctx.filePath,
          );

    const evidence = await this.prisma.evidence.create({
      data: {
        projectId: ctx.projectId,
        kind: 'SOURCE_EXCERPT',
        title: ctx.filePath,
        uri,
      },
      select: { id: true },
    });

    return evidence.id;
  }
}
