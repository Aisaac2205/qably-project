import { Injectable } from '@nestjs/common';
import type {
  CodeChange,
  Evidence,
  IngestionBatch,
  RepoConnectionProvider,
} from '@qably/types';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { RepositoryError, RepositoryView } from './repository.contracts';

const BATCH_SOURCE = {
  REPOSITORY: 'repository',
  WEBHOOK: 'webhook',
} as const;

const BATCH_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

const EVIDENCE_KIND = {
  SOURCE_EXCERPT: 'source_excerpt',
  ARTIFACT: 'artifact',
  URL: 'url',
} as const;

const PROJECT_SELECT = {
  testFilePatterns: true,
  connection: { select: { provider: true, repo: true } },
} as const;

const BATCH_SELECT = {
  id: true,
  source: true,
  status: true,
  createdAt: true,
  codeChanges: {
    orderBy: { filePath: 'asc' },
    select: {
      id: true,
      pullRequestNumber: true,
      commitSha: true,
      filePath: true,
      diff: true,
      detectedPattern: true,
      evidenceId: true,
      evidence: {
        select: {
          id: true,
          kind: true,
          title: true,
          uri: true,
          excerpt: true,
          createdAt: true,
        },
      },
    },
  },
} as const;

interface ProjectRow {
  testFilePatterns: string[];
  connection: { provider: RepoConnectionProvider; repo: string } | null;
}

interface EvidenceRow {
  id: string;
  kind: keyof typeof EVIDENCE_KIND;
  title: string;
  uri: string;
  excerpt: string | null;
  createdAt: Date;
}

interface CodeChangeRow {
  id: string;
  pullRequestNumber: number | null;
  commitSha: string;
  filePath: string;
  diff: string;
  detectedPattern: string | null;
  evidenceId: string;
  evidence: EvidenceRow;
}

interface BatchRow {
  id: string;
  source: keyof typeof BATCH_SOURCE;
  status: keyof typeof BATCH_STATUS;
  createdAt: Date;
  codeChanges: CodeChangeRow[];
}

function toCodeChange(row: CodeChangeRow, projectId: string): CodeChange {
  return {
    id: row.id,
    projectId,
    ...(row.pullRequestNumber === null
      ? {}
      : { pullRequestNumber: row.pullRequestNumber }),
    commitSha: row.commitSha,
    filePath: row.filePath,
    diff: row.diff,
    ...(row.detectedPattern === null
      ? {}
      : { detectedPattern: row.detectedPattern }),
    evidenceId: row.evidenceId,
  };
}

function toEvidence(row: EvidenceRow, projectId: string): Evidence {
  return {
    id: row.id,
    projectId,
    kind: EVIDENCE_KIND[row.kind],
    title: row.title,
    uri: row.uri,
    ...(row.excerpt === null ? {} : { excerpt: row.excerpt }),
    createdAt: row.createdAt.toISOString(),
  };
}

function toBatch(row: BatchRow, projectId: string): IngestionBatch {
  return {
    id: row.id,
    projectId,
    source: BATCH_SOURCE[row.source],
    status: BATCH_STATUS[row.status],
    codeChangeIds: row.codeChanges.map((change) => change.id),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class RepositoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    org: OrgContext,
    projectId: string,
  ): Promise<Result<RepositoryView, RepositoryError>> {
    const project: ProjectRow | null = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: org.organizationId },
      select: PROJECT_SELECT,
    });

    if (project === null) return err('not-found');

    const batch: BatchRow | null = await this.prisma.ingestionBatch.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: BATCH_SELECT,
    });

    return ok({
      source:
        project.connection === null
          ? null
          : {
              provider: project.connection.provider,
              repo: project.connection.repo,
              testFilePatterns: project.testFilePatterns,
            },
      batch: batch === null ? null : toBatch(batch, projectId),
      codeChanges:
        batch?.codeChanges.map((row) => toCodeChange(row, projectId)) ?? [],
      evidence:
        batch?.codeChanges.map((row) => toEvidence(row.evidence, projectId)) ??
        [],
    });
  }
}
