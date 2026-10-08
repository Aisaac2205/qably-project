import type { RepoConnectionProvider } from '@qably/types';

export type ScmEventKind = 'push' | 'pull_request';

export interface NormalizedScmCommit {
  /** Lowercase 40-hex commit sha. */
  sha: string;
  /** 0-based index in the kept list, in the order the provider delivered. */
  position: number;
  /** First line of the commit message, trimmed, at most 200 characters. */
  message: string;
  author: string;
  /** The provider's commit timestamp as delivered, or null when it does not parse. */
  committedAt: string | null;
  url: string | null;
}

export interface NormalizedScmEvent {
  eventId: string;
  provider: RepoConnectionProvider;
  kind: ScmEventKind;
  repo: string;
  branch: string;
  commitSha: string;
  author: string;
  title: string;
  url: string;
  changedFiles: string[];
  /** Sha the ref pointed at before the push; null for a new ref or when unknown. */
  beforeSha: string | null;
  forced: boolean;
  /** Commits the push contained; empty when the provider does not report them. */
  commits: NormalizedScmCommit[];
  /** True when `commits` omits commits of the push (our cap or the provider's). */
  commitsTruncated: boolean;
}

export type ScmHeaders = Record<string, string | undefined>;

export interface ScmPayloadAdapter {
  readonly provider: RepoConnectionProvider;

  verifySignature(
    rawBody: string,
    headers: ScmHeaders,
    secret: string,
  ): boolean;

  normalize(payload: unknown, headers: ScmHeaders): NormalizedScmEvent | null;
}

export type IngestOutcome = 'accepted' | 'duplicate' | 'ignored';

export type IngestError = 'unknown-provider' | 'unverified' | 'invalid-payload';

export interface ScmEventJob {
  scmEventId: string;
}
