import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { resolveLocale } from '@qably/i18n';
import { MAX_EXTRACTED_CASES } from '../ai/extraction.contracts';
import { isCaseDocumentable } from '../../common/locale/documentable-case';
import { resolveOrgDefaultLocale } from '../../common/locale/org-default-locale';
import { isLocaleStale } from '../../common/locale/stale-locale';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { buildJobId } from '../../common/queue/job-id';
import { resolveAutomationFilePath } from './lib/resolve-automation-file-path';
import {
  EXTRACTION_QUEUE,
  type DocumentCaseError,
  type DocumentFileTarget,
  type DocumentFilesError,
  type DocumentFilesMode,
  type DocumentFilesResult,
  type DocumentFilesSkip,
  type ExtractionJobData,
} from './review.contracts';

const PENDING_STATUS = 'in_review';

export const MAX_DOCUMENT_FILES_PER_REQUEST = 50;

export type DocumentFilesScope = { suiteId: string } | { projectId: string };

interface CodeChangeCandidate {
  id: string;
  detectedPattern: string | null;
}

interface DocumentFileCandidate {
  id: string;
  projectId: string;
  automationKey: string | null;
  automationFilePath: string | null;
  steps: string[];
  documentationSource: string;
  currentVersion: { locale: string | null } | null;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildSkips(
  noSourceFile: number,
  alreadyPending: number,
  humanDocumented: number,
): DocumentFilesSkip[] {
  const skips: DocumentFilesSkip[] = [];
  if (noSourceFile > 0) {
    skips.push({ reason: 'no-source-file', count: noSourceFile });
  }
  if (alreadyPending > 0) {
    skips.push({ reason: 'already-pending', count: alreadyPending });
  }
  if (humanDocumented > 0) {
    skips.push({ reason: 'human-documented', count: humanDocumented });
  }
  return skips;
}

@Injectable()
export class ExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EXTRACTION_QUEUE)
    private readonly queue: Queue<ExtractionJobData>,
  ) {}

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
      },
    });

    if (testCase === null) return err('not-found');
    if (testCase.executionMode !== 'automated') return err('not-automated');

    const pending = await this.prisma.extractedProposal.findFirst({
      where: { targetTestCaseId: caseId, status: PENDING_STATUS },
      select: { id: true },
    });

    if (pending !== null) return err('already-pending');

    const filePath =
      testCase.automationFilePath ??
      (await resolveAutomationFilePath(
        this.prisma,
        testCase.projectId,
        testCase.automationKey,
      ));

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

    const rows = (await this.prisma.testCase.findMany({
      where: {
        ...scopeWhere,
        executionMode: 'automated',
      },
      select: {
        id: true,
        projectId: true,
        automationKey: true,
        automationFilePath: true,
        steps: true,
        documentationSource: true,
        currentVersion: { select: { locale: true } },
      },
    })) as DocumentFileCandidate[];

    if (rows.length === 0) {
      return ok({ filesEnqueued: 0, casesTargeted: 0, casesSkipped: [] });
    }

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

    let alreadyPending = 0;
    let noSourceFile = 0;
    let humanDocumented = 0;
    const groupedByFile = new Map<string, DocumentFileTarget[]>();

    for (const row of rows) {
      if (row.documentationSource === 'human') {
        humanDocumented += 1;
        continue;
      }

      const documentedLocale = row.currentVersion?.locale ?? null;
      const matchesMode =
        mode === 'undocumented'
          ? row.steps.length === 0
          : row.steps.length > 0 &&
            isLocaleStale(
              { steps: row.steps, documentedLocale },
              orgDefaultLocale,
            );

      if (!matchesMode) continue;

      const hasPendingProposal = pendingIds.has(row.id);

      const documentable = isCaseDocumentable(
        {
          executionMode: 'automated',
          steps: row.steps,
          documentedLocale,
          automationKey: row.automationKey,
          hasPendingProposal,
        },
        mode,
        orgDefaultLocale,
      );

      if (!documentable) {
        if (hasPendingProposal) alreadyPending += 1;
        else noSourceFile += 1;
        continue;
      }

      const automationKey = row.automationKey as string;
      const filePath =
        row.automationFilePath ??
        (await resolveAutomationFilePath(
          this.prisma,
          row.projectId,
          automationKey,
        ));

      if (filePath === null) {
        noSourceFile += 1;
        continue;
      }

      const group = groupedByFile.get(filePath) ?? [];
      group.push({ testCaseId: row.id, automationKey });
      groupedByFile.set(filePath, group);
    }

    const casesSkipped = buildSkips(
      noSourceFile,
      alreadyPending,
      humanDocumented,
    );

    if (groupedByFile.size === 0) {
      return ok({ filesEnqueued: 0, casesTargeted: 0, casesSkipped });
    }

    const locale =
      actorLocale === null ? orgDefaultLocale : resolveLocale(actorLocale);

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

    for (const [filePath, targets] of files) {
      chunk(targets, MAX_EXTRACTED_CASES).forEach((chunkTargets, index) => {
        casesTargeted += chunkTargets.length;
        jobs.push({
          name: 'document-file',
          data: {
            kind: 'document-file',
            filePath,
            targets: chunkTargets,
            locale,
          },
          opts: {
            jobId: buildJobId('document-file', [projectId, filePath, index]),
          },
        });
      });
    }

    await this.queue.addBulk(jobs);

    return ok({
      filesEnqueued: files.length,
      casesTargeted,
      casesSkipped,
    });
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
