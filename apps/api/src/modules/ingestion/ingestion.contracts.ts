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
  /**
   * NOT the list of files the commit touched, and never a way to answer "which
   * commits touched file X". These are only the paths a code change may be
   * attributed to this commit for, so that a code change can name the last
   * commit of the push that touched its file. A path appears here only when
   * this commit can safely be named for it, so the list can be partial or
   * empty: it is capped per commit (the GitHub adapter keeps 1000), empty when
   * the provider reports no paths or the push order is not verified, and it
   * leaves out a path that a later commit touched but could not be recorded
   * (no valid sha, a repeated sha, or past the cap). Otherwise the paths are
   * distinct and in the order the payload lists them (added, modified,
   * removed).
   */
  attributedFiles: string[];
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
