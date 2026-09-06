import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { RepoConnectionProvider } from '@qably/types';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TEST_CASE_EXTRACTOR } from '../ai/ai.tokens';
import { EXTRACTION_PROMPT_VERSION } from '../ai/extraction-prompt';
import type {
  ExtractedCase,
  TestCaseExtractor,
} from '../ai/extraction.contracts';
import { buildBlobUrl, SourceReader } from '../repository/source-reader';
import { detectLanguage } from './lib/detect-language';
import { EXTRACTION_QUEUE, type ExtractionJobData } from './review.contracts';

const DEFAULT_LOCALE = 'es' as const;
const MAX_FALLBACK_OBJECTIVE_LENGTH = 500;
const HEAD_REF = 'HEAD';

interface ConnectionInfo {
  provider: RepoConnectionProvider;
  repo: string;
  encryptedAccessToken: string | null;
}

interface JobContext {
  projectId: string;
  filePath: string;
  ref: string;
  connection: ConnectionInfo | null;
  codeChangeId: string | null;
  targetTestCaseId: string | null;
  knownSuiteId: string | null;
  onlyAutomationKey: string | null;
  fallbackEvidenceId: string | null;
}

interface TxClient {
  suite: { findFirst: PrismaService['suite']['findFirst'] };
  testCase: { findFirst: PrismaService['testCase']['findFirst'] };
  evidence: { create: PrismaService['evidence']['create'] };
  extractedProposal: {
    findFirst: PrismaService['extractedProposal']['findFirst'];
    create: PrismaService['extractedProposal']['create'];
    upsert: PrismaService['extractedProposal']['upsert'];
  };
}

function splitRepo(full: string): { owner: string; repo: string } {
  const index = full.indexOf('/');
  return index === -1
    ? { owner: full, repo: full }
    : { owner: full.slice(0, index), repo: full.slice(index + 1) };
}

@Processor(EXTRACTION_QUEUE, { concurrency: 2 })
export class ExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceReader: SourceReader,
    @Inject(TEST_CASE_EXTRACTOR) private readonly extractor: TestCaseExtractor,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<ExtractionJobData>): Promise<void> {
    if (job.data.kind === 'code-change') {
      await this.processCodeChange(job.data.codeChangeId);
    } else {
      await this.processDocumentCase(job.data.testCaseId);
    }
  }

  private async processCodeChange(codeChangeId: string): Promise<void> {
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
      filePath: codeChange.filePath,
      ref: codeChange.commitSha,
      connection: codeChange.project.connection,
      codeChangeId: codeChange.id,
      targetTestCaseId: null,
      knownSuiteId: null,
      onlyAutomationKey: null,
      fallbackEvidenceId: codeChange.evidenceId,
    });
  }

  private async processDocumentCase(testCaseId: string): Promise<void> {
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

    if (testCase === null || testCase.automationFilePath === null) {
      this.logger.warn(`Test case ${testCaseId} is no longer documentable`);
      return;
    }

    const ref = await this.latestCommitShaFor(
      testCase.projectId,
      testCase.automationFilePath,
    );

    await this.runExtraction({
      projectId: testCase.projectId,
      filePath: testCase.automationFilePath,
      ref,
      connection: testCase.project.connection,
      codeChangeId: null,
      targetTestCaseId: testCase.id,
      knownSuiteId: testCase.suiteId,
      onlyAutomationKey: testCase.automationKey,
      fallbackEvidenceId: null,
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

  private async runExtraction(ctx: JobContext): Promise<void> {
    if (ctx.connection === null) {
      await this.persistManualReviewFallback(ctx, 'no-connection');
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

    const outcome = await this.extractor.extract({
      filePath: ctx.filePath,
      language: detectLanguage(ctx.filePath),
      content: source.content,
      locale: DEFAULT_LOCALE,
      ...(ctx.onlyAutomationKey === null
        ? {}
        : { automationKey: ctx.onlyAutomationKey }),
    });

    if (outcome.kind === 'no-tests-found') {
      this.logger.log(`No tests found in ${ctx.filePath}`);
      return;
    }

    if (outcome.kind === 'provider-unavailable') {
      await this.persistManualReviewFallback(ctx, outcome.reason);
      return;
    }

    const cases =
      ctx.onlyAutomationKey === null
        ? outcome.cases
        : outcome.cases.filter(
            (candidate) => candidate.automationKey === ctx.onlyAutomationKey,
          );

    if (cases.length === 0) {
      this.logger.log(
        `Extraction for ${ctx.filePath} did not include the requested case`,
      );
      return;
    }

    await this.persistExtracted(cases, ctx);
  }

  private async persistExtracted(
    cases: readonly ExtractedCase[],
    ctx: JobContext,
  ): Promise<void> {
    const connection = ctx.connection as ConnectionInfo;

    await this.prisma.$transaction(async (tx: TxClient) => {
      const suiteId =
        ctx.knownSuiteId ??
        (await this.resolveSuiteId(tx, ctx.projectId, ctx.filePath));

      for (const testCase of cases) {
        if (ctx.targetTestCaseId !== null) {
          const pending = await tx.extractedProposal.findFirst({
            where: {
              targetTestCaseId: ctx.targetTestCaseId,
              status: 'in_review',
            },
            select: { id: true },
          });

          if (pending !== null) continue;
        }

        const matchedCaseId =
          ctx.targetTestCaseId ??
          (suiteId === null
            ? null
            : ((
                await tx.testCase.findFirst({
                  where: { suiteId, automationKey: testCase.automationKey },
                  select: { id: true },
                })
              )?.id ?? null));

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
            excerpt: testCase.sourceExcerpt,
          },
          select: { id: true },
        });

        const shared = {
          projectId: ctx.projectId,
          evidenceId: evidence.id,
          suiteId,
          status: 'in_review' as const,
          title: testCase.title,
          objective: testCase.objective,
          preconditions: [...testCase.preconditions],
          steps: [...testCase.steps],
          expectedResult: testCase.expectedResult,
          priority: testCase.priority,
          promptVersion: EXTRACTION_PROMPT_VERSION,
        };

        if (ctx.codeChangeId !== null) {
          await tx.extractedProposal.upsert({
            where: {
              codeChangeId_automationKey: {
                codeChangeId: ctx.codeChangeId,
                automationKey: testCase.automationKey,
              },
            },
            create: {
              ...shared,
              codeChangeId: ctx.codeChangeId,
              automationKey: testCase.automationKey,
              targetTestCaseId: matchedCaseId,
            },
            update: {
              ...shared,
              targetTestCaseId: matchedCaseId,
            },
          });
        } else {
          await tx.extractedProposal.create({
            data: {
              ...shared,
              codeChangeId: null,
              automationKey: testCase.automationKey,
              targetTestCaseId: ctx.targetTestCaseId,
            },
          });
        }
      }
    });
  }

  private async resolveSuiteId(
    tx: TxClient,
    projectId: string,
    filePath: string,
  ): Promise<string | null> {
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
