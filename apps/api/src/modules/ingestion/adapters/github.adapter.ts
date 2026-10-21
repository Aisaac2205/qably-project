import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  NormalizedScmCommit,
  NormalizedScmEvent,
  ScmHeaders,
  ScmPayloadAdapter,
} from '../ingestion.contracts';

const SIGNATURE_HEADER = 'x-hub-signature-256';
const EVENT_HEADER = 'x-github-event';
const DELIVERY_HEADER = 'x-github-delivery';
const BRANCH_PREFIX = 'refs/heads/';
const HANDLED_PR_ACTIONS = ['opened', 'synchronize'];
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const NULL_SHA = '0'.repeat(40);
const MAX_KEPT_COMMITS = 250;
// A commit that rewrites a whole tree can list thousands of paths. Only the
// first ones are attributed to the commit; the net `changedFiles` of the event
// is not capped.
const MAX_ATTRIBUTED_FILES_PER_COMMIT = 1000;
// GitHub documents "a maximum of 2048 commits" in a push payload, so a delivery
// that long may have been cut by GitHub itself.
const GITHUB_COMMIT_LIMIT = 2048;
const MAX_MESSAGE_LENGTH = 200;
const ISO_8601_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

interface FileChanges {
  added?: unknown;
  modified?: unknown;
  removed?: unknown;
}

interface PushPayload {
  ref?: string;
  before?: unknown;
  after?: unknown;
  forced?: unknown;
  repository?: { full_name?: string; default_branch?: unknown };
  pusher?: { name?: string };
  head_commit?:
    | (FileChanges & {
        id?: string;
        message?: string;
        url?: string;
      })
    | null;
  commits?: unknown;
}

// One entry of the delivered `commits` list. The id may be unusable, in which
// case the commit cannot be stored but its files still count for the push.
interface DeliveredCommit {
  /** Lowercase sha; null when the delivered id is not a 40-hex sha. */
  sha: string | null;
  raw: Record<string, unknown>;
}

type StorableCommit = DeliveredCommit & { sha: string };

type StoredCommitDetails = Omit<
  NormalizedScmCommit,
  'position' | 'attributedFiles'
>;

interface PullRequestPayload {
  action?: string;
  pull_request?: {
    head?: { ref?: string; sha?: string };
    title?: string;
    html_url?: string;
    user?: { login?: string };
  };
  // For a pull request this is the repository the pull request targets, not the
  // fork the head branch lives in.
  repository?: { full_name?: string; default_branch?: unknown };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

// The trimmed name, or null when the field is missing, blank or not a string.
function readBranchName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readSha(value: unknown): string | null {
  const sha = typeof value === 'string' ? value.toLowerCase() : '';

  return SHA_PATTERN.test(sha) ? sha : null;
}

function readPaths(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((path): path is string => typeof path === 'string')
    : [];
}

function readMessage(value: unknown): string {
  if (typeof value !== 'string') return '';

  const firstLine = value.split(/\r?\n/, 1)[0].trim();
  const cut = firstLine.slice(0, MAX_MESSAGE_LENGTH);
  const last = cut.charCodeAt(cut.length - 1);

  // Never leave half of a surrogate pair at the cut.
  return cut.length < firstLine.length && last >= 0xd800 && last <= 0xdbff
    ? cut.slice(0, -1)
    : cut;
}

// GitHub sends commit times as ISO 8601 with an explicit offset. Date.parse
// alone also accepts local-time and free-form strings, so the shape is checked
// first and Date.parse only rules out impossible values such as month 13.
function readTimestamp(value: unknown): string | null {
  return typeof value === 'string' &&
    ISO_8601_TIMESTAMP.test(value) &&
    !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function hasSha(commit: DeliveredCommit): commit is StorableCommit {
  return commit.sha !== null;
}

// A repeated sha would break the (event, sha) uniqueness of the stored list,
// and that violation is indistinguishable from a replayed delivery.
function distinctBySha(commits: StorableCommit[]): StorableCommit[] {
  const seen = new Set<string>();

  return commits.filter(({ sha }) => {
    if (seen.has(sha)) return false;

    seen.add(sha);

    return true;
  });
}

// Entries that are not objects carry no files and are skipped; an object with
// an unusable id is kept so its files are not lost.
function readDeliveredCommit(entry: unknown): DeliveredCommit[] {
  const raw = asRecord(entry);

  return raw === null ? [] : [{ sha: readSha(raw.id), raw }];
}

function describeCommit({ sha, raw }: StorableCommit): StoredCommitDetails {
  const author = asRecord(raw.author);

  return {
    sha,
    message: readMessage(raw.message),
    author: readText(author?.username) ?? readText(author?.name) ?? 'unknown',
    committedAt: readTimestamp(raw.timestamp),
    url: readText(raw.url),
  };
}

// Added, modified, then removed, each path once.
function distinctPaths(changes: FileChanges): string[] {
  return [
    ...new Set([
      ...readPaths(changes.added),
      ...readPaths(changes.modified),
      ...readPaths(changes.removed),
    ]),
  ];
}

// The paths each stored commit may be named for, which is NOT the list of files
// it touched. A path is withheld when a later delivered commit touched it but no
// stored commit records it (a commit without a valid id, a repeated sha, or a
// path past the per-commit cap): naming the earlier commit would point at a
// stale version of the file, whereas leaving it out makes the code change fall
// back to the tip of the push, which is always current. Without a verified
// order "later" is unknown, so nothing is attributed.
function attributedFilesByCommit(
  pushed: DeliveredCommit[],
  storable: StorableCommit[],
  orderVerified: boolean,
): Map<StorableCommit, string[]> {
  const attributed = new Map<StorableCommit, string[]>();

  if (!orderVerified) {
    for (const commit of storable) attributed.set(commit, []);

    return attributed;
  }

  const stored = new Set<DeliveredCommit>(storable);
  const isStored = (commit: DeliveredCommit): commit is StorableCommit =>
    stored.has(commit);
  const unrecorded = new Set<string>();

  // Newest first, so `unrecorded` holds what later commits left unrecorded.
  for (const commit of [...pushed].reverse()) {
    const paths = distinctPaths(commit.raw);
    let recordedCount = 0;

    if (isStored(commit)) {
      const recorded = paths.slice(0, MAX_ATTRIBUTED_FILES_PER_COMMIT);

      attributed.set(
        commit,
        recorded.filter((path) => !unrecorded.has(path)),
      );
      recordedCount = recorded.length;
    }

    for (const path of paths.slice(recordedCount)) unrecorded.add(path);
  }

  return attributed;
}

// Replays the commits in order against a set of present paths: an addition or
// modification puts a path in, a removal takes it out. A path keeps the place
// where it was first seen, so the output order is stable.
function netChangedFiles(history: FileChanges[]): string[] {
  const present = new Map<string, boolean>();

  for (const files of history) {
    for (const path of readPaths(files.removed)) present.set(path, false);
    for (const path of readPaths(files.added)) present.set(path, true);
    for (const path of readPaths(files.modified)) present.set(path, true);
  }

  return [...present]
    .filter(([, isPresent]) => isPresent)
    .map(([path]) => path);
}

// Without a verified order a removal cannot be tied to the commit that came
// after the addition, so only the head commit's removals are trusted.
function unorderedChangedFiles(
  history: FileChanges[],
  head: FileChanges,
): string[] {
  const touched = new Set<string>();

  for (const files of history) {
    for (const path of readPaths(files.added)) touched.add(path);
    for (const path of readPaths(files.modified)) touched.add(path);
  }

  const removedByHead = new Set(readPaths(head.removed));

  return [...touched].filter((path) => !removedByHead.has(path));
}

// A newly created ref has no previous commit; GitHub reports it as all zeros.
function readBeforeSha(value: unknown): string | null {
  const sha = readSha(value);

  return sha === NULL_SHA ? null : sha;
}

// GitHub does not document the order of `commits`, so it is only trusted when
// the last delivered commit is provably the head of the push. A last commit
// without a valid id proves nothing.
function isOrderVerified(
  payload: PushPayload,
  head: FileChanges & { id?: string },
  pushed: DeliveredCommit[],
): boolean {
  const lastSha = pushed.at(-1)?.sha ?? null;

  return (
    lastSha !== null &&
    [readSha(payload.after), readSha(head.id)].includes(lastSha)
  );
}

// The file list spans every delivered commit, including the ones that cannot be
// stored: the caps bound what is stored about the push, not what extraction can
// see, and a commit with an unusable id must not make its files vanish.
function resolveChangedFiles(
  head: FileChanges,
  pushed: DeliveredCommit[],
  orderVerified: boolean,
): string[] {
  if (pushed.length === 0) return netChangedFiles([head]);

  const history = pushed.map(({ raw }) => raw);

  return orderVerified
    ? netChangedFiles(history)
    : unorderedChangedFiles([...history, head], head);
}

@Injectable()
export class GithubAdapter implements ScmPayloadAdapter {
  readonly provider = 'GITHUB' as const;

  verifySignature(
    rawBody: string,
    headers: ScmHeaders,
    secret: string,
  ): boolean {
    const received = headers[SIGNATURE_HEADER];

    if (received === undefined) return false;

    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

    if (expected.length !== received.length) return false;

    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  }

  normalize(payload: unknown, headers: ScmHeaders): NormalizedScmEvent | null {
    const body = asRecord(payload);
    const eventId = headers[DELIVERY_HEADER];

    if (body === null || eventId === undefined) return null;

    switch (headers[EVENT_HEADER]) {
      case 'push':
        return this.fromPush(body, eventId);
      case 'pull_request':
        return this.fromPullRequest(body, eventId);
      default:
        return null;
    }
  }

  private fromPush(
    payload: PushPayload,
    eventId: string,
  ): NormalizedScmEvent | null {
    const commit = payload.head_commit;
    const repo = payload.repository?.full_name;

    if (!commit?.id || repo === undefined) return null;

    const delivered = Array.isArray(payload.commits) ? payload.commits : [];
    const pushed = delivered.flatMap(readDeliveredCommit);
    const distinct = distinctBySha(pushed.filter(hasSha));
    const kept = distinct.slice(-MAX_KEPT_COMMITS);
    const orderVerified = isOrderVerified(payload, commit, pushed);
    const attributed = attributedFilesByCommit(pushed, distinct, orderVerified);

    return {
      eventId,
      provider: this.provider,
      kind: 'push',
      repo,
      branch: (payload.ref ?? '').replace(BRANCH_PREFIX, '').trim(),
      defaultBranch: readBranchName(payload.repository?.default_branch),
      commitSha: commit.id,
      author: payload.pusher?.name ?? 'unknown',
      title: commit.message ?? '',
      url: commit.url ?? '',
      changedFiles: resolveChangedFiles(commit, pushed, orderVerified),
      beforeSha: readBeforeSha(payload.before),
      forced: payload.forced === true,
      commits: kept.map((entry, position) => ({
        ...describeCommit(entry),
        position,
        attributedFiles: attributed.get(entry) ?? [],
      })),
      commitsTruncated:
        distinct.length > MAX_KEPT_COMMITS ||
        delivered.length >= GITHUB_COMMIT_LIMIT,
    };
  }

  private fromPullRequest(
    payload: PullRequestPayload,
    eventId: string,
  ): NormalizedScmEvent | null {
    const action = payload.action ?? '';
    const pull = payload.pull_request;
    const repo = payload.repository?.full_name;

    if (!HANDLED_PR_ACTIONS.includes(action)) return null;
    if (pull?.head?.sha === undefined || repo === undefined) return null;

    return {
      eventId,
      provider: this.provider,
      kind: 'pull_request',
      repo,
      branch: (pull.head.ref ?? '').trim(),
      defaultBranch: readBranchName(payload.repository?.default_branch),
      commitSha: pull.head.sha,
      author: pull.user?.login ?? 'unknown',
      title: pull.title ?? '',
      url: pull.html_url ?? '',
      // The pull request payload carries neither a file list nor the commits,
      // so it stays metadata-only.
      changedFiles: [],
      beforeSha: null,
      forced: false,
      commits: [],
      commitsTruncated: false,
    };
  }
}
