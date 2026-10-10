import { Injectable } from '@nestjs/common';
import type { AttributedCommit, RunAttribution } from '@qably/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  computeCommitRange,
  type CommitRangeEntry,
  type CommitRangeEvent,
  type CommitRangeResult,
} from './lib/compute-commit-range';

/**
 * Most recent push events read per call. A chain that needs older pushes is
 * not proven, so it ends as `history_gap` instead of being guessed.
 */
export const MAX_SCANNED_EVENTS = 1000;

export interface AttributionPair {
  /** Caller-chosen identity of the pair, used to read its answer back. */
  key: string;
  /** `Run.commitSha` of the baseline run. */
  baseSha: string | null;
  /** `Run.commitSha` of the later run. */
  headSha: string | null;
}

export interface AttributeInput {
  organizationId: string;
  projectId: string;
  pairs: ReadonlyArray<AttributionPair>;
}

const EVENT_SELECT = {
  id: true,
  kind: true,
  branch: true,
  commitSha: true,
  beforeSha: true,
  forced: true,
  commitsTruncated: true,
  receivedAt: true,
  commits: {
    orderBy: { position: 'asc' },
    select: {
      sha: true,
      position: true,
      message: true,
      author: true,
      committedAt: true,
      url: true,
    },
  },
} as const;

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toAttributedCommit(entry: CommitRangeEntry): AttributedCommit {
  return {
    sha: entry.sha,
    message: entry.message,
    author: entry.author,
    committedAt: toIsoString(entry.committedAt),
    url: entry.url,
    branch: entry.branch,
  };
}

function toRunAttribution(result: CommitRangeResult): RunAttribution {
  switch (result.kind) {
    case 'same_commit':
      return { kind: 'same_commit', sha: result.sha };
    case 'unknown':
      return { kind: 'unknown', reason: result.reason };
    case 'range':
      return {
        kind: 'range',
        baseSha: result.baseSha,
        headSha: result.headSha,
        commits: result.commits.map(toAttributedCommit),
      };
  }
}

/**
 * Lists the commits pushed between pairs of runs, from the push events the
 * repository connection of the project already recorded. The answer is a set
 * of candidates, never a cause. Reads the database at most twice per call,
 * however many pairs it is asked about, and not at all when every pair is
 * decided by the run shas alone.
 */
@Injectable()
export class RunAttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async attribute(input: AttributeInput): Promise<Map<string, RunAttribution>> {
    const attributions = new Map<string, RunAttribution>();
    const needingHistory: AttributionPair[] = [];

    // Without events the function answers `no_repository_connected` exactly
    // when it would need them; every other answer is already final.
    for (const pair of input.pairs) {
      const result = computeCommitRange({
        baseSha: pair.baseSha,
        headSha: pair.headSha,
        events: null,
      });
      attributions.set(pair.key, toRunAttribution(result));
      if (
        result.kind === 'unknown' &&
        result.reason === 'no_repository_connected'
      ) {
        needingHistory.push(pair);
      }
    }
    if (needingHistory.length === 0) return attributions;

    const events = await this.loadPushEvents(
      input.organizationId,
      input.projectId,
    );
    if (events === null) return attributions;

    for (const pair of needingHistory) {
      const result = computeCommitRange({
        baseSha: pair.baseSha,
        headSha: pair.headSha,
        events,
      });
      attributions.set(pair.key, toRunAttribution(result));
    }

    return attributions;
  }

  /** Null when the project has no repository connection. */
  private async loadPushEvents(
    organizationId: string,
    projectId: string,
  ): Promise<CommitRangeEvent[] | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { connectionId: true },
    });
    if (project === null || project.connectionId === null) return null;

    return this.prisma.scmEvent.findMany({
      where: {
        connectionId: project.connectionId,
        organizationId,
        kind: 'PUSH',
      },
      orderBy: { receivedAt: 'desc' },
      take: MAX_SCANNED_EVENTS,
      select: EVENT_SELECT,
    });
  }
}
