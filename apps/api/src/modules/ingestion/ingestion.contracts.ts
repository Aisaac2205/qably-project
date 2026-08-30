import type { RepoConnectionProvider } from '@qably/types';

export type ScmEventKind = 'push' | 'pull_request';

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
