import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { resolveLocale, type Locale } from '@qably/i18n';
import { assessSuiteDocumentation } from '@qably/types';
import { MAX_EXTRACTED_CASES } from '../ai/extraction.contracts';
import {
  classifyDocumentableCase,
  type CaseNotDocumentableReason,
} from '../../common/locale/documentable-case';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { buildJobId } from '../../common/queue/job-id';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { TestFileLocator } from '../repository/test-file-locator';
import type { DocumentationStateWrite } from './lib/publish-test-case-version';
import { resolveAutomationFilePath } from './lib/resolve-automation-file-path';
import {
  locateAndPersistAutomationFilePath,
  type LocateAndPersistDeps,
} from './lib/locate-and-persist-automation-file-path';
import {
  EXTRACTION_QUEUE,
  type DocumentCaseError,
  type DocumentFileTarget,
  type DocumentFilesError,
  type DocumentFilesMode,
  type DocumentFilesResult,
  type DocumentFilesSkip,
  type DocumentFilesSkipReason,
  type ExtractionJobData,
} from './review.contracts';

const PENDING_STATUS = 'in_review';
const HEAD_REF = 'HEAD';

export const MAX_DOCUMENT_FILES_PER_REQUEST = 50;

export type DocumentFilesScope = { suiteId: string } | { projectId: string };

interface CodeChangeCandidate {
  id: string;
  detectedPattern: string | null;
}

interface DocumentFileCandidate {
  id: string;
  projectId: string;
  suiteId: string;
  name: string;
  automationKey: string | null;
  automationFilePath: string | null;
  automationClassName: string | null;
  suite: { name: string } | null;
  steps: string[];
  objective: string;
  expectedResult: string;
  documentationSource: string;
  documentationOutcome: string | null;
  currentVersion: { locale: string | null } | null;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type SkippedIds = Record<DocumentFilesSkipReason, string[]>;

function emptySkippedIds(): SkippedIds {
  return {
    'no-source-file': [],
    'no-automation-key': [],
    'already-pending': [],
    'human-documented': [],
  };
}

function toSkipReason(
  reason: CaseNotDocumentableReason,
): DocumentFilesSkipReason | null {
  switch (reason) {
    case 'out-of-scope':
    case 'not-automated':
      return null;
    case 'already-pending':
      return 'already-pending';
    case 'no-automation-key':
      return 'no-automation-key';
  }
}

function buildSkips(skippedIds: SkippedIds): DocumentFilesSkip[] {
  return (Object.entries(skippedIds) as [DocumentFilesSkipReason, string[]][])
    .filter(([, ids]) => ids.length > 0)
    .map(([reason, ids]) => ({ reason, count: ids.length }));
}

@Injectable()
export class ExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EXTRACTION_QUEUE)
    private readonly queue: Queue<ExtractionJobData>,
    private readonly encryption: EncryptionService,
    private readonly testFileLocator: TestFileLocator,
  ) {}

  private async persistDocumentationQueued(
    testCaseIds: readonly string[],
  ): Promise<void> {
    if (testCaseIds.length === 0) return;

    await this.prisma.testCase.updateMany({
      where: { id: { in: [...testCaseIds] } },
      data: { documentationQueuedAt: new Date() },
    });
  }

  private async clearDocumentationQueued(
    testCaseIds: readonly string[],
  ): Promise<void> {
    if (testCaseIds.length === 0) return;

    await this.prisma.testCase.updateMany({
      where: { id: { in: [...testCaseIds] } },
      data: { documentationQueuedAt: null },
    });
  }

  private async persistSkippedOutcomes(skippedIds: SkippedIds): Promise<void> {
    const now = new Date();

    const writes = (
      Object.entries(skippedIds) as [DocumentFilesSkipReason, string[]][]
    )
      .filter(([, ids]) => ids.length > 0)
      .map(([reason, ids]) => {
        const skippedState: DocumentationStateWrite = {
          documentationOutcome: 'skipped',
          documentationSkipReason: reason,
          documentationOutcomeAt: now,
          documentationQueuedAt: null,
        };

        return this.prisma.testCase.updateMany({
          where: { id: { in: ids } },
          data: skippedState,
        });
      });

    await Promise.all(writes);
  }

  private locatorDeps(): LocateAndPersistDeps {
    return {
      locate: (input) => this.testFileLocator.locate(input),
      decrypt: (value) => this.encryption.decrypt(value),
      persist: (id, path) =>
        this.prisma.testCase
          .update({ where: { id }, data: { automationFilePath: path } })
          .then(() => undefined),
    };
  }

  async enqueueCodeChanges(
    codeChanges: CodeChangeCandidate[],
    organizationId: string,
  ): Promise<number> {
    const targets = codeChanges.filter(
      (change) => change.detectedPattern !== null,
    );

    if (targets.length === 0) return 0;

    const locale = await resolveOrgDefaultLocale(this.prisma, organizationId);

    await this.queue.addBulk(
      targets.map((change) => ({
        name: 'code-change',
        data: {
          kind: 'code-change' as const,
          codeChangeId: change.id,
          locale,
        },
        opts: { jobId: buildJobId('code-change', [change.id]) },
      })),
    );

    return targets.length;
  }

  async enqueueDocumentCase(
    org: OrgContext,
    suiteId: string,
    caseId: string,
    actorLocale: string | null,
  ): Promise<Result<{ jobId: string }, DocumentCaseError>> {
    const testCase = await this.prisma.testCase.findFirst({
      where: {
        id: caseId,
        suiteId,
        suite: { organizationId: org.organizationId },
      },
      select: {
        id: true,
        projectId: true,
        executionMode: true,
        automationFilePath: true,
        automationKey: true,
        automationClassName: true,
        name: true,
        suite: { select: { name: true } },
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

    if (testCase === null) return err('not-found');
    if (testCase.executionMode !== 'automated') return err('not-automated');

    const pending = await this.prisma.extractedProposal.findFirst({
      where: { targetTestCaseId: caseId, status: PENDING_STATUS },
      select: { id: true },
    });

    if (pending !== null) return err('already-pending');
    if (testCase.automationKey === null) return err('no-automation-key');

    const filePath =
      testCase.automationFilePath ??
      (await resolveAutomationFilePath(
        this.prisma,
        testCase.projectId,
        testCase.automationKey,
        testCase.automationClassName,
      )) ??
      (await locateAndPersistAutomationFilePath(this.locatorDeps(), {
        testCaseId: testCase.id,
        automationKey: testCase.automationKey,
        automationClassName: testCase.automationClassName,
        caseName: testCase.name,
        suiteName: testCase.suite?.name ?? null,
        connection: testCase.project.connection,
        ref: HEAD_REF,
      }));

    if (filePath === null) return err('no-source-file');

    const locale =
      actorLocale === null
        ? await resolveOrgDefaultLocale(this.prisma, org.organizationId)
        : resolveLocale(actorLocale);

    const jobId = buildJobId('document-case', [caseId]);

    await this.queue.add(
      'document-case',
      { kind: 'document-case', testCaseId: caseId, locale },
      { jobId },
    );

    return ok({ jobId });
  }

  async enqueueDocumentFiles(
    org: OrgContext,
    scope: DocumentFilesScope,
    actorLocale: string | null,
    mode: DocumentFilesMode = 'undocumented',
  ): Promise<Result<DocumentFilesResult, DocumentFilesError>> {
    const scopeIsValid = await this.scopeExists(org, scope);
    if (!scopeIsValid) return err('not-found');

    const scopeWhere =
      'suiteId' in scope
        ? { suiteId: scope.suiteId }
        : { projectId: scope.projectId };

    const orgDefaultLocale = await resolveOrgDefaultLocale(
      this.prisma,
      org.organizationId,
    );
    const locale =
      actorLocale === null ? orgDefaultLocale : resolveLocale(actorLocale);

    const suiteJob =
      'suiteId' in scope
        ? await this.buildSuiteMetadataJob(scope.suiteId, locale)
        : null;

    const rows = (await this.prisma.testCase.findMany({
      where: {
        ...scopeWhere,
        executionMode: 'automated',
      },
      select: {
        id: true,
        projectId: true,
        suiteId: true,
        name: true,
        automationKey: true,
        automationFilePath: true,
        automationClassName: true,
        suite: { select: { name: true } },
        steps: true,
        objective: true,
        expectedResult: true,
        documentationSource: true,
        documentationOutcome: true,
        currentVersion: { select: { locale: true } },
      },
    })) as DocumentFileCandidate[];

    if (rows.length === 0) {
      return ok(
        await this.finalizeDocumentFiles(
          { filesEnqueued: 0, casesTargeted: 0, casesSkipped: [] },
          suiteJob,
        ),
      );
    }

    const connection = await this.prisma.project.findUnique({
      where: { id: rows[0].projectId },
      select: {
        connection: {
          select: { provider: true, repo: true, encryptedAccessToken: true },
        },
      },
    });

    const pendingRows = await this.prisma.extractedProposal.findMany({
      where: {
        targetTestCaseId: { in: rows.map((row) => row.id) },
        status: PENDING_STATUS,
      },
      select: { targetTestCaseId: true },
    });
    const pendingIds = new Set(
      pendingRows
        .map((row) => row.targetTestCaseId)
        .filter((id): id is string => id !== null),
    );

    const skippedIds = emptySkippedIds();
    const groupedByFile = new Map<string, DocumentFileTarget[]>();
    const fileSuiteIds = new Map<string, Set<string>>();

    for (const row of rows) {
      if (row.documentationSource === 'human') {
        skippedIds['human-documented'].push(row.id);
        continue;
      }

      const verdict = classifyDocumentableCase(
        {
          executionMode: 'automated',
          steps: row.steps,
          documentedLocale: row.currentVersion?.locale ?? null,
          automationKey: row.automationKey,
          hasPendingProposal: pendingIds.has(row.id),
          name: row.name,
          objective: row.objective,
          expectedResult: row.expectedResult,
          documentationSource: row.documentationSource,
          documentationOutcome: row.documentationOutcome,
        },
        mode,
        orgDefaultLocale,
      );

      if (!verdict.documentable) {
        const reason = toSkipReason(verdict.reason);
        if (reason !== null) skippedIds[reason].push(row.id);
        continue;
      }

      const automationKey = row.automationKey as string;
      const filePath =
        row.automationFilePath ??
        (await resolveAutomationFilePath(
          this.prisma,
          row.projectId,
          automationKey,
          row.automationClassName,
        )) ??
        (await locateAndPersistAutomationFilePath(this.locatorDeps(), {
          testCaseId: row.id,
          automationKey,
          automationClassName: row.automationClassName,
          caseName: row.name,
          suiteName: row.suite?.name ?? null,
          connection: connection?.connection ?? null,
          ref: HEAD_REF,
        }));

      if (filePath === null) {
        skippedIds['no-source-file'].push(row.id);
        continue;
      }

      const group = groupedByFile.get(filePath) ?? [];
      group.push({ testCaseId: row.id, automationKey });
      groupedByFile.set(filePath, group);

      if (typeof row.suiteId === 'string') {
        const suiteIdsForFile = fileSuiteIds.get(filePath) ?? new Set<string>();
        suiteIdsForFile.add(row.suiteId);
        fileSuiteIds.set(filePath, suiteIdsForFile);
      }
    }

    const casesSkipped = buildSkips(skippedIds);
    await this.persistSkippedOutcomes(skippedIds);

    if (groupedByFile.size === 0) {
      return ok(
        await this.finalizeDocumentFiles(
          { filesEnqueued: 0, casesTargeted: 0, casesSkipped },
          suiteJob,
        ),
      );
    }

    const projectId = rows[0].projectId;
    const files = [...groupedByFile.entries()].slice(
      0,
      MAX_DOCUMENT_FILES_PER_REQUEST,
    );

    let casesTargeted = 0;
    const jobs: {
      name: string;
      data: ExtractionJobData;
      opts: { jobId: string };
    }[] = [];
    const queuedCaseIds: string[] = [];
    const isProjectScope = 'projectId' in scope;
    const incompleteSuiteIds = isProjectScope
      ? await this.resolveIncompleteSuiteIds(
          this.uniformSuiteIdsFor(files, fileSuiteIds),
        )
      : new Set<string>();
    const claimedSuiteIds = new Set<string>();

    for (const [filePath, targets] of files) {
      const suiteIdsForFile = fileSuiteIds.get(filePath);
      const uniformSuiteId =
        suiteIdsForFile !== undefined && suiteIdsForFile.size === 1
          ? [...suiteIdsForFile][0]
          : null;

      chunk(targets, MAX_EXTRACTED_CASES).forEach((chunkTargets, index) => {
        casesTargeted += chunkTargets.length;
        queuedCaseIds.push(...chunkTargets.map((target) => target.testCaseId));

        const requestSuiteSummary =
          isProjectScope &&
          uniformSuiteId !== null &&
          incompleteSuiteIds.has(uniformSuiteId) &&
          !claimedSuiteIds.has(uniformSuiteId);

        if (requestSuiteSummary) claimedSuiteIds.add(uniformSuiteId);

        jobs.push({
          name: 'document-file',
          data: {
            kind: 'document-file',
            filePath,
            targets: chunkTargets,
            locale,
            requestSuiteSummary,
          },
          opts: {
            jobId: buildJobId('document-file', [projectId, filePath, index]),
          },
        });
      });
    }

    await this.persistDocumentationQueued(queuedCaseIds);
    if (suiteJob !== null) {
      await this.persistSuiteDocumentationQueued(suiteJob.suiteId);
      jobs.push(suiteJob.job);
    }

    try {
      await this.queue.addBulk(jobs);
    } catch (error) {
      await this.clearDocumentationQueued(queuedCaseIds);
      if (suiteJob !== null) {
        await this.clearSuiteDocumentationQueued(suiteJob.suiteId);
      }
      throw error;
    }

    return ok({
      filesEnqueued: files.length,
      casesTargeted,
      casesSkipped,
      ...(suiteJob !== null ? { suiteQueued: true } : {}),
    });
  }

  private uniformSuiteIdsFor(
    files: readonly [string, DocumentFileTarget[]][],
    fileSuiteIds: ReadonlyMap<string, Set<string>>,
  ): string[] {
    const suiteIds = new Set<string>();

    for (const [filePath] of files) {
      const suiteIdsForFile = fileSuiteIds.get(filePath);
      if (suiteIdsForFile !== undefined && suiteIdsForFile.size === 1) {
        suiteIds.add([...suiteIdsForFile][0]);
      }
    }

    return [...suiteIds];
  }

  private async resolveIncompleteSuiteIds(
    suiteIds: readonly string[],
  ): Promise<Set<string>> {
    if (suiteIds.length === 0) return new Set();

    const suites = await this.prisma.suite.findMany({
      where: { id: { in: [...suiteIds] } },
      select: { id: true, name: true, description: true, tags: true },
    });

    const incomplete = new Set<string>();
    for (const suite of suites) {
      const assessment = assessSuiteDocumentation({
        name: suite.name,
        description: suite.description,
        tags: suite.tags,
      });
      if (!assessment.complete) incomplete.add(suite.id);
    }

    return incomplete;
  }

  private async buildSuiteMetadataJob(
    suiteId: string,
    locale: Locale,
  ): Promise<{
    suiteId: string;
    job: { name: string; data: ExtractionJobData; opts: { jobId: string } };
  } | null> {
    const suite = await this.prisma.suite.findFirst({
      where: { id: suiteId },
      select: { projectId: true, name: true, description: true, tags: true },
    });

    if (suite === null) return null;

    const assessment = assessSuiteDocumentation({
      name: suite.name,
      description: suite.description,
      tags: suite.tags,
    });

    if (assessment.complete) return null;

    return {
      suiteId,
      job: {
        name: 'document-suite-metadata',
        data: { kind: 'document-suite-metadata', suiteId, locale },
        opts: {
          jobId: buildJobId('document-suite', [suite.projectId, suiteId]),
        },
      },
    };
  }

  private async persistSuiteDocumentationQueued(
    suiteId: string,
  ): Promise<void> {
    await this.prisma.suite.update({
      where: { id: suiteId },
      data: { documentationQueuedAt: new Date() },
    });
  }

  private async clearSuiteDocumentationQueued(suiteId: string): Promise<void> {
    await this.prisma.suite.update({
      where: { id: suiteId },
      data: { documentationQueuedAt: null },
    });
  }

  private async finalizeDocumentFiles(
    base: DocumentFilesResult,
    suiteJob: {
      suiteId: string;
      job: { name: string; data: ExtractionJobData; opts: { jobId: string } };
    } | null,
  ): Promise<DocumentFilesResult> {
    if (suiteJob === null) return base;

    await this.persistSuiteDocumentationQueued(suiteJob.suiteId);

    try {
      await this.queue.addBulk([suiteJob.job]);
    } catch (error) {
      await this.clearSuiteDocumentationQueued(suiteJob.suiteId);
      throw error;
    }

    return { ...base, suiteQueued: true };
  }

  private async scopeExists(
    org: OrgContext,
    scope: DocumentFilesScope,
  ): Promise<boolean> {
    if ('suiteId' in scope) {
      const suite = await this.prisma.suite.findFirst({
        where: { id: scope.suiteId, organizationId: org.organizationId },
        select: { id: true },
      });
      return suite !== null;
    }

    const project = await this.prisma.project.findFirst({
      where: { id: scope.projectId, organizationId: org.organizationId },
      select: { id: true },
    });
    return project !== null;
  }
}
