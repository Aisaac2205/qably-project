import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import {
  assessCaseDocumentation,
  assessSuiteDocumentation,
} from '@qably/types';
import { assertNever } from '../../common/assert-never';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import { TEST_CASE_EXTRACTOR } from '../ai/ai.tokens';
import type {
  ExtractedCase,
  ExtractedSuite,
  ExtractionInput,
  ExtractionOutcome,
  TestCaseExtractor,
} from '../ai/extraction.contracts';
import { countTestDeclarations } from '../ai/count-test-declarations';
import { buildTargetManifest } from '../ai/target-reference';
import { SourceReader } from '../repository/source-reader';
import { splitRepo } from '../repository/lib/split-repo';
import { TestFileLocator } from '../repository/test-file-locator';
import { normalizeAutomationFilePath } from '../../common/paths/normalize-automation-file-path';
import { detectLanguage } from './lib/detect-language';
import {
  isSameDocumentation,
  publishTestCaseVersion,
  type DocumentationStateWrite,
  type PublishTestCaseVersionFields,
} from './lib/publish-test-case-version';
import { normalizeAutomationKey } from './lib/normalize-automation-key';
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

const MAX_CASE_OBSERVATIONS = 5;
const HEAD_REF = 'HEAD';
const NOT_ENTITLED_REASON = 'ai-not-enabled';
const NO_MATCHING_CASE_REASON = 'automation-key-not-found';
const NO_TESTS_FOUND_REASON = 'no-tests-found';
const EXTRACTION_INCOMPLETE_REASON = 'extraction-incomplete';
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
const SUITE_TAG_CAP = 20;
const SUITE_STATES_FOR_SUMMARY = ['active', 'draft'] as const;

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
    private readonly failureRecorder: ExtractionFailureRecorder,
    private readonly proposalWriter: ExtractedProposalWriter,
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
    });

    if (source.kind === 'unavailable') {
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        source.reason,
      );
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
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        ctx.targets,
        QUOTA_EXHAUSTED_REASON,
      );
      return;
    }

    const locale = resolveLocale(ctx.locale);

    // Both the prompt (targetAutomationKeys, tagged positionally) and the
    // manifest (buildTargetManifest, tagged by testCaseId-sorted order)
    // must derive tag numbers from the identical order for the same target
    // set — ctx.targets arrives in unspecified DB order, so sort once here
    // and use sortedTargets for every downstream derivation instead of
    // reading ctx.targets directly again.
    const sortedTargets = [...ctx.targets].sort((a, b) =>
      a.testCaseId.localeCompare(b.testCaseId),
    );

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
    const manifest = buildTargetManifest(sortedTargets);
    const firstRound = matchRound(sortedTargets, outcome.cases, manifest);

    let matched: { target: DocumentFileTarget; testCase: ExtractedCase }[] = [
      ...firstRound.matched,
    ];
    let unmatched: DocumentFileTarget[] = [...firstRound.unmatched];

    if (unmatched.length > 0) {
      const retryOutcome = await this.extractor.extract({
        filePath: ctx.filePath,
        language: detectLanguage(ctx.filePath),
        content: source.content,
        locale,
        targetAutomationKeys: unmatched.map((target) => target.automationKey),
        requestSuiteSummary: ctx.requestSuiteSummary,
      });

      if (retryOutcome.kind === 'extracted') {
        // A fresh manifest, renumbered from T1 and scoped to only the
        // still-unmatched subset: a tag means a different thing in each
        // round, so round 1's and round 2's manifests/case pools must
        // never mix.
        const retryManifest = buildTargetManifest(unmatched);
        const retryRound = matchRound(
          unmatched,
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

    if (matched.length === 0) {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.failureRecorder.recordExtractionFailureForTargets(
        ctx,
        unmatched,
        NO_MATCHING_CASE_REASON,
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
        NO_MATCHING_CASE_REASON,
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

        await tx.extractedProposal.deleteMany({
          where: {
            targetTestCaseId: target.testCaseId,
            needsManualReview: true,
            status: 'in_review',
          },
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

  private async runExtraction(ctx: JobContext): Promise<void> {
    try {
      await this.runExtractionUnsafe(ctx);
    } catch (error) {
      if (error instanceof RetryableProviderError) throw error;
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

    const source = await this.sourceReader.read({
      provider: ctx.connection.provider,
      owner,
      repo,
      ref: ctx.ref,
      path: normalizeAutomationFilePath(ctx.filePath, repo),
      accessToken,
    });

    if (source.kind === 'unavailable') {
      await this.failureRecorder.recordExtractionFailure(ctx, source.reason);
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
        NO_MATCHING_CASE_REASON,
      );
      return;
    }

    const persisted = await this.proposalWriter.persistExtracted(cases, ctx);
    if (!persisted) {
      await this.failureRecorder.recordExtractionFailure(
        ctx,
        NOT_ENTITLED_REASON,
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
