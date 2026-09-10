import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import type { RepoConnectionProvider } from '@qably/types';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiDailyBudget } from '../ai/ai-daily-budget.service';
import { AiEntitlementService } from '../ai/ai-entitlement.service';
import { TEST_CASE_EXTRACTOR } from '../ai/ai.tokens';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import type {
  ExtractedCase,
  ExtractedSuite,
  TestCaseExtractor,
} from '../ai/extraction.contracts';
import { buildBlobUrl, SourceReader } from '../repository/source-reader';
import { detectLanguage } from './lib/detect-language';
import { resolveAutomationFilePath } from './lib/resolve-automation-file-path';
import {
  EXTRACTION_QUEUE,
  type DocumentFileTarget,
  type ExtractionJobData,
} from './review.contracts';

const MAX_FALLBACK_OBJECTIVE_LENGTH = 500;
const HEAD_REF = 'HEAD';
const NOT_ENTITLED_REASON = 'ai-not-enabled';
const NO_MATCHING_CASE_REASON = 'automation-key-not-found';
const NO_TESTS_FOUND_REASON = 'no-tests-found';
const EXTRACTION_FAILED_REASON = 'extraction-failed';
const QUOTA_EXHAUSTED_REASON = 'quota-exhausted';
const NOT_BYOK = { isByok: false };
const UNIQUE_VIOLATION = 'P2002';
const LOCK_DURATION_MS = 120_000;

interface ConnectionInfo {
  provider: RepoConnectionProvider;
  repo: string;
  encryptedAccessToken: string | null;
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
}

interface DocumentFileJobContext {
  projectId: string;
  organizationId: string;
  filePath: string;
  ref: string;
  connection: ConnectionInfo | null;
  targets: DocumentFileTarget[];
  locale: string | undefined;
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

interface TxClient {
  suite: { findFirst: PrismaService['suite']['findFirst'] };
  testCase: {
    findFirst: PrismaService['testCase']['findFirst'];
    findMany: PrismaService['testCase']['findMany'];
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
  suiteProposal: {
    findFirst: PrismaService['suiteProposal']['findFirst'];
    create: PrismaService['suiteProposal']['create'];
  };
  organization: { updateMany: PrismaService['organization']['updateMany'] };
  $executeRawUnsafe: PrismaService['$executeRawUnsafe'];
}

const PROPOSAL_SAVEPOINT = 'extraction_proposal';
const SUITE_PROPOSAL_SAVEPOINT = 'suite_proposal';

async function lockTestCases(tx: TxClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  await tx.$executeRawUnsafe(
    `SELECT id FROM "test_case" WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
    ...ids,
  );
}

async function lockSuite(tx: TxClient, suiteId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT id FROM "suite" WHERE id = $1 FOR UPDATE`,
    suiteId,
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function splitRepo(full: string): { owner: string; repo: string } {
  const index = full.indexOf('/');
  return index === -1
    ? { owner: full, repo: full }
    : { owner: full.slice(0, index), repo: full.slice(index + 1) };
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
  ) {
    super();
  }

  async process(job: Job<ExtractionJobData>): Promise<void> {
    if (job.data.kind === 'code-change') {
      await this.processCodeChange(job.data.codeChangeId, job.data.locale);
    } else if (job.data.kind === 'document-case') {
      await this.processDocumentCase(job.data.testCaseId, job.data.locale);
    } else {
      await this.processDocumentFile(
        job.data.filePath,
        job.data.targets,
        job.data.locale,
      );
    }
  }

  private async processCodeChange(
    codeChangeId: string,
    locale: string | undefined,
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
    });
  }

  private async processDocumentCase(
    testCaseId: string,
    locale: string | undefined,
  ): Promise<void> {
    const testCase = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: {
        id: true,
        projectId: true,
        suiteId: true,
        automationKey: true,
        automationFilePath: true,
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

  private async processDocumentFile(
    filePath: string,
    targets: DocumentFileTarget[],
    locale: string | undefined,
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
    });
  }

  private async runDocumentFileExtraction(
    ctx: DocumentFileJobContext,
  ): Promise<void> {
    try {
      await this.runDocumentFileExtractionUnsafe(ctx);
    } catch (error) {
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

    const withinBudget = await this.dailyBudget.tryConsume(NOT_BYOK);
    if (!withinBudget) {
      await this.fallbackForTargets(ctx, ctx.targets, QUOTA_EXHAUSTED_REASON);
      return;
    }

    const locale = resolveLocale(ctx.locale);

    const outcome = await this.extractor.extract({
      filePath: ctx.filePath,
      language: detectLanguage(ctx.filePath),
      content: source.content,
      locale,
      targetAutomationKeys: ctx.targets.map((target) => target.automationKey),
    });

    if (outcome.kind === 'provider-unavailable') {
      await this.fallbackForTargets(ctx, ctx.targets, outcome.reason);
      return;
    }

    if (outcome.kind === 'no-tests-found') {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.fallbackForTargets(ctx, ctx.targets, NO_TESTS_FOUND_REASON);
      return;
    }

    const deduped = dedupeByAutomationKey(outcome.cases);
    const byAutomationKey = new Map(
      deduped.map((testCase) => [testCase.automationKey, testCase]),
    );

    const matched: { target: DocumentFileTarget; testCase: ExtractedCase }[] =
      [];
    const unmatched: DocumentFileTarget[] = [];

    for (const target of ctx.targets) {
      const testCase = byAutomationKey.get(target.automationKey);
      if (testCase === undefined) {
        unmatched.push(target);
      } else {
        matched.push({ target, testCase });
      }
    }

    if (matched.length === 0) {
      if (!(await this.spendCreditOrFallbackForTargets(ctx, ctx.targets))) {
        return;
      }
      await this.fallbackForTargets(ctx, unmatched, NO_MATCHING_CASE_REASON);
      return;
    }

    const persisted = await this.persistDocumentFileTargets(
      matched,
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
    const connection = ctx.connection as ConnectionInfo;
    const suiteRows = await this.prisma.testCase.findMany({
      where: { id: { in: matched.map(({ target }) => target.testCaseId) } },
      select: { id: true, suiteId: true },
    });
    const suiteIdByCaseId = new Map(
      suiteRows.map((row) => [row.id, row.suiteId]),
    );

    return this.prisma.$transaction(async (tx: TxClient) => {
      await lockTestCases(
        tx,
        matched.map(({ target }) => target.testCaseId),
      );

      const spent = await this.entitlement.spendCredit(ctx.organizationId, tx);
      if (!spent) return false;

      for (const { target, testCase } of matched) {
        const pending = await tx.extractedProposal.findFirst({
          where: { targetTestCaseId: target.testCaseId, status: 'in_review' },
          select: { id: true },
        });

        if (pending !== null) continue;

        const uri = buildBlobUrl(
          connection.provider,
          connection.repo,
          ctx.ref,
          ctx.filePath,
        );

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
            projectId: ctx.projectId,
            suiteId: suiteIdByCaseId.get(target.testCaseId) ?? null,
            status: 'in_review',
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
            evidenceId: evidence.id,
            codeChangeId: null,
            automationKey: testCase.automationKey,
            targetTestCaseId: target.testCaseId,
          },
        });
      }

      await this.persistSuiteProposal(tx, ctx, suite, [
        ...new Set(suiteIdByCaseId.values()),
      ]);

      return true;
    });
  }

  private async persistSuiteProposal(
    tx: TxClient,
    ctx: DocumentFileJobContext,
    suite: ExtractedSuite | null,
    suiteIds: string[],
  ): Promise<void> {
    if (suite === null || suiteIds.length !== 1) return;
    const [suiteId] = suiteIds;
    const connection = ctx.connection as ConnectionInfo;

    await lockSuite(tx, suiteId);

    const pending = await tx.suiteProposal.findFirst({
      where: { suiteId, status: 'in_review' },
      select: { id: true },
    });
    if (pending !== null) return;

    await tx.$executeRawUnsafe(`SAVEPOINT ${SUITE_PROPOSAL_SAVEPOINT}`);

    try {
      const evidence = await tx.evidence.create({
        data: {
          projectId: ctx.projectId,
          kind: 'SOURCE_EXCERPT',
          title: ctx.filePath,
          uri: buildBlobUrl(
            connection.provider,
            connection.repo,
            ctx.ref,
            ctx.filePath,
          ),
          excerpt: null,
        },
        select: { id: true },
      });

      await tx.suiteProposal.create({
        data: {
          projectId: ctx.projectId,
          suiteId,
          title: suite.title,
          description: suite.description,
          status: 'in_review',
          evidenceId: evidence.id,
          promptVersion: EXTRACTION_PROMPT_VERSION,
          locale: ctx.locale ?? null,
        },
      });

      await tx.$executeRawUnsafe(
        `RELEASE SAVEPOINT ${SUITE_PROPOSAL_SAVEPOINT}`,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      await tx.$executeRawUnsafe(
        `ROLLBACK TO SAVEPOINT ${SUITE_PROPOSAL_SAVEPOINT}`,
      );
      await tx.$executeRawUnsafe(
        `RELEASE SAVEPOINT ${SUITE_PROPOSAL_SAVEPOINT}`,
      );

      this.logger.log(
        `Lost the race to propose a name for suite ${suiteId}; another job already has one pending`,
      );
    }
  }

  private async fallbackForTargets(
    ctx: DocumentFileJobContext,
    targets: readonly DocumentFileTarget[],
    reason: string,
  ): Promise<void> {
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
        },
        reason,
      );
    }
  }

  private async runExtraction(ctx: JobContext): Promise<void> {
    try {
      await this.runExtractionUnsafe(ctx);
    } catch (error) {
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

    const withinBudget = await this.dailyBudget.tryConsume(NOT_BYOK);
    if (!withinBudget) {
      await this.persistManualReviewFallback(ctx, QUOTA_EXHAUSTED_REASON);
      return;
    }

    const locale = resolveLocale(ctx.locale);

    const outcome = await this.extractor.extract({
      filePath: ctx.filePath,
      language: detectLanguage(ctx.filePath),
      content: source.content,
      locale,
      ...(ctx.onlyAutomationKey === null
        ? {}
        : { automationKey: ctx.onlyAutomationKey }),
    });

    if (outcome.kind === 'provider-unavailable') {
      await this.persistManualReviewFallback(ctx, outcome.reason);
      return;
    }

    if (outcome.kind === 'no-tests-found') {
      if (!(await this.spendCreditOrFallback(ctx))) return;

      if (ctx.targetTestCaseId !== null) {
        await this.persistManualReviewFallback(ctx, NO_TESTS_FOUND_REASON);
        return;
      }
      this.logger.log(`No tests found in ${ctx.filePath}`);
      return;
    }

    const deduped = dedupeByAutomationKey(outcome.cases);
    const cases =
      ctx.onlyAutomationKey === null
        ? deduped
        : deduped.filter(
            (candidate) => candidate.automationKey === ctx.onlyAutomationKey,
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
