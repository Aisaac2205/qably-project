import { Inject, Injectable, Optional } from '@nestjs/common';
import type { RepoConnectionProvider } from '@qably/types';
import {
  sanitizeUntrustedText,
  stripBlockDelimiters,
} from '../../common/prompt/untrusted-text';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { splitRepo } from '../repository/lib/split-repo';
import { SourceReader } from '../repository/source-reader';

export const CASE_CONTEXT_OPEN = '<<<CASE_CONTEXT>>>';
export const CASE_CONTEXT_CLOSE = '<<<END_CASE_CONTEXT>>>';

const ALL_DELIMITERS = [CASE_CONTEXT_OPEN, CASE_CONTEXT_CLOSE];

export const MAX_EXCERPT_LENGTH_PER_CASE = 6_000;
export const MAX_EXCERPT_LENGTH_PER_MESSAGE = 24_000;
const EXCERPT_CONTEXT_LINES = 40;
const HEAD_REF = 'HEAD';
const REF_TIMEOUT_MS = 15_000;
const MESSAGE_BUDGET_REASON = 'message-budget';

export interface CaseContextCandidate {
  id: string;
  name: string;
  objective: string;
  preconditions: readonly string[];
  steps: readonly string[];
  expectedResult: string;
  documentationSource: string;
  missing: readonly string[];
  automationKey: string | null;
  automationFilePath: string | null;
}

export interface CaseContextConnection {
  provider: RepoConnectionProvider;
  repo: string;
  encryptedAccessToken: string | null;
}

export interface DefaultRefResolver {
  resolve(
    connection: CaseContextConnection,
    accessToken: string | undefined,
  ): Promise<string>;
}

type LocatedExcerpt =
  | { kind: 'declaration'; excerpt: string; startLine: number; endLine: number }
  | { kind: 'file-head'; excerpt: string };

export type ExcerptOutcome =
  | LocatedExcerpt
  | { kind: 'unavailable'; reason: string };

export type EvidenceCandidate = Pick<
  CaseContextCandidate,
  'automationKey' | 'automationFilePath'
>;

interface ResolvedCase {
  candidate: CaseContextCandidate;
  ref: string;
  excerpt: ExcerptOutcome;
}

function lastAutomationKeySegment(automationKey: string | null): string | null {
  if (automationKey === null) return null;

  const segments = automationKey.split(' > ');
  const last = segments[segments.length - 1]?.trim();
  return last === undefined || last.length === 0 ? null : last;
}

function findDeclarationLine(
  lines: readonly string[],
  literal: string,
): number | null {
  const exact = lines.findIndex((line) => line.trim() === literal);
  if (exact !== -1) return exact;

  const lowerLiteral = literal.toLowerCase();
  const loose = lines.findIndex((line) =>
    line.toLowerCase().includes(lowerLiteral),
  );
  return loose === -1 ? null : loose;
}

export function locateExcerpt(
  content: string,
  automationKey: string | null,
): LocatedExcerpt {
  const literal = lastAutomationKeySegment(automationKey);
  const lines = content.split('\n');
  const lineIndex =
    literal === null ? null : findDeclarationLine(lines, literal);

  if (lineIndex === null) {
    return {
      kind: 'file-head',
      excerpt: content.slice(0, MAX_EXCERPT_LENGTH_PER_CASE),
    };
  }

  const start = Math.max(0, lineIndex - EXCERPT_CONTEXT_LINES);
  const end = Math.min(lines.length, lineIndex + EXCERPT_CONTEXT_LINES + 1);

  return {
    kind: 'declaration',
    excerpt: lines
      .slice(start, end)
      .join('\n')
      .slice(0, MAX_EXCERPT_LENGTH_PER_CASE),
    startLine: start + 1,
    endLine: end,
  };
}

function droppedForBudget(entry: ResolvedCase): ResolvedCase {
  return {
    ...entry,
    excerpt: { kind: 'unavailable', reason: MESSAGE_BUDGET_REASON },
  };
}

function applyMessageBudget(resolved: readonly ResolvedCase[]): ResolvedCase[] {
  let total = 0;
  let overBudget = false;

  return resolved.map((entry) => {
    if (entry.excerpt.kind === 'unavailable') return entry;
    if (overBudget) return droppedForBudget(entry);

    const length = entry.excerpt.excerpt.length;
    if (total + length > MAX_EXCERPT_LENGTH_PER_MESSAGE) {
      overBudget = true;
      return droppedForBudget(entry);
    }

    total += length;
    return entry;
  });
}

function joinOrNone(values: readonly string[], maxLength: number): string {
  return values.length === 0
    ? '(none)'
    : values
        .map((value) => sanitizeUntrustedText(value, maxLength))
        .join(' | ');
}

function formatSection(resolved: ResolvedCase): string {
  const c = resolved.candidate;
  const lines: string[] = [
    `Case ID: ${c.id}`,
    `Title: ${sanitizeUntrustedText(c.name, 200)}`,
    `Objective: ${sanitizeUntrustedText(c.objective, 500)}`,
    `Preconditions: ${joinOrNone(c.preconditions, 300)}`,
    `Steps: ${joinOrNone(c.steps, 300)}`,
    `Expected result: ${sanitizeUntrustedText(c.expectedResult, 500)}`,
    `Documentation source: ${sanitizeUntrustedText(c.documentationSource, 60)}`,
    `Missing fields: ${c.missing.length === 0 ? '(none)' : c.missing.join(', ')}`,
    `Automation key: ${
      c.automationKey === null
        ? '(none)'
        : sanitizeUntrustedText(c.automationKey, 200)
    }`,
    `File: ${
      c.automationFilePath === null
        ? '(unknown)'
        : sanitizeUntrustedText(c.automationFilePath, 300)
    }`,
    `Ref: ${sanitizeUntrustedText(resolved.ref, 100)}`,
  ];

  if (resolved.excerpt.kind === 'unavailable') {
    lines.push(
      resolved.excerpt.reason === MESSAGE_BUDGET_REASON
        ? 'Excerpt: omitted (message context budget reached).'
        : `Source: unavailable (${sanitizeUntrustedText(resolved.excerpt.reason, 60)}).`,
    );
  } else if (resolved.excerpt.kind === 'file-head') {
    lines.push('Excerpt (file head, declaration not located):');
    lines.push(stripBlockDelimiters(resolved.excerpt.excerpt, ALL_DELIMITERS));
  } else {
    lines.push(
      `Excerpt (lines ${resolved.excerpt.startLine}-${resolved.excerpt.endLine}):`,
    );
    lines.push(stripBlockDelimiters(resolved.excerpt.excerpt, ALL_DELIMITERS));
  }

  return lines.join('\n');
}

function buildCaseContextTurn(resolved: readonly ResolvedCase[]): string {
  if (resolved.length === 0) return '';

  const sections = resolved.map(formatSection).join('\n\n');
  return `${CASE_CONTEXT_OPEN}\n${sections}\n${CASE_CONTEXT_CLOSE}`;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

@Injectable()
export class GitDefaultRefResolver implements DefaultRefResolver {
  constructor(
    @Optional()
    private readonly fetchImpl: FetchLike = (url, init) =>
      globalThis.fetch(url, init),
  ) {}

  async resolve(
    connection: CaseContextConnection,
    accessToken: string | undefined,
  ): Promise<string> {
    try {
      const { owner, repo } = splitRepo(connection.repo);
      return connection.provider === 'GITHUB'
        ? await this.resolveGithub(owner, repo, accessToken)
        : await this.resolveBitbucket(owner, repo, accessToken);
    } catch {
      return HEAD_REF;
    }
  }

  private async resolveGithub(
    owner: string,
    repo: string,
    accessToken: string | undefined,
  ): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (accessToken !== undefined)
      headers.Authorization = `Bearer ${accessToken}`;

    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    const repoResponse = await this.fetchImpl(base, {
      headers,
      signal: AbortSignal.timeout(REF_TIMEOUT_MS),
    });
    if (!repoResponse.ok) return HEAD_REF;

    const repoPayload = (await repoResponse.json()) as {
      default_branch?: string;
    };
    const branch = repoPayload.default_branch;
    if (branch === undefined) return HEAD_REF;

    const commitResponse = await this.fetchImpl(
      `${base}/commits/${encodeURIComponent(branch)}`,
      { headers, signal: AbortSignal.timeout(REF_TIMEOUT_MS) },
    );
    if (!commitResponse.ok) return HEAD_REF;

    const commitPayload = (await commitResponse.json()) as { sha?: string };
    return commitPayload.sha ?? HEAD_REF;
  }

  private async resolveBitbucket(
    owner: string,
    repo: string,
    accessToken: string | undefined,
  ): Promise<string> {
    const headers: Record<string, string> = {};
    if (accessToken !== undefined)
      headers.Authorization = `Bearer ${accessToken}`;

    const base = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    const repoResponse = await this.fetchImpl(base, {
      headers,
      signal: AbortSignal.timeout(REF_TIMEOUT_MS),
    });
    if (!repoResponse.ok) return HEAD_REF;

    const repoPayload = (await repoResponse.json()) as {
      mainbranch?: { name?: string };
    };
    const branch = repoPayload.mainbranch?.name;
    if (branch === undefined) return HEAD_REF;

    const commitsResponse = await this.fetchImpl(
      `${base}/commits/${encodeURIComponent(branch)}?pagelen=1`,
      { headers, signal: AbortSignal.timeout(REF_TIMEOUT_MS) },
    );
    if (!commitsResponse.ok) return HEAD_REF;

    const commitsPayload = (await commitsResponse.json()) as {
      values?: { hash?: string }[];
    };
    return commitsPayload.values?.[0]?.hash ?? HEAD_REF;
  }
}

@Injectable()
export class CaseContextBuilder {
  constructor(
    @Inject(SourceReader)
    private readonly sourceReader: Pick<SourceReader, 'read'>,
    @Inject(EncryptionService)
    private readonly encryption: Pick<EncryptionService, 'decrypt'>,
    @Inject(GitDefaultRefResolver)
    private readonly defaultRefResolver: DefaultRefResolver,
  ) {}

  async build(
    candidates: readonly CaseContextCandidate[],
    connection: CaseContextConnection | null,
  ): Promise<string> {
    if (candidates.length === 0) return '';

    const accessToken =
      connection === null || connection.encryptedAccessToken === null
        ? undefined
        : this.encryption.decrypt(connection.encryptedAccessToken);

    const ref =
      connection === null
        ? HEAD_REF
        : await this.defaultRefResolver.resolve(connection, accessToken);

    const resolved: ResolvedCase[] = [];
    for (const candidate of candidates) {
      resolved.push({
        candidate,
        ref,
        excerpt: await this.resolveExcerpt(
          candidate,
          connection,
          accessToken,
          ref,
        ),
      });
    }

    return buildCaseContextTurn(applyMessageBudget(resolved));
  }

  async locateForEvidence(
    candidate: EvidenceCandidate,
    connection: CaseContextConnection | null,
  ): Promise<{ ref: string; excerpt: ExcerptOutcome }> {
    const accessToken =
      connection === null || connection.encryptedAccessToken === null
        ? undefined
        : this.encryption.decrypt(connection.encryptedAccessToken);

    const ref =
      connection === null
        ? HEAD_REF
        : await this.defaultRefResolver.resolve(connection, accessToken);

    const excerpt = await this.resolveExcerpt(
      candidate,
      connection,
      accessToken,
      ref,
    );

    return { ref, excerpt };
  }

  private async resolveExcerpt(
    candidate: EvidenceCandidate,
    connection: CaseContextConnection | null,
    accessToken: string | undefined,
    ref: string,
  ): Promise<ExcerptOutcome> {
    if (connection === null) {
      return { kind: 'unavailable', reason: 'no-connection' };
    }
    if (candidate.automationFilePath === null) {
      return { kind: 'unavailable', reason: 'no-source-file' };
    }

    const { owner, repo } = splitRepo(connection.repo);
    const source = await this.sourceReader.read({
      provider: connection.provider,
      owner,
      repo,
      ref,
      path: candidate.automationFilePath,
      accessToken,
    });

    if (source.kind === 'unavailable') {
      const hasNoToken = connection.encryptedAccessToken === null;
      const isAuthOrNotFound =
        source.reason === 'http-401' ||
        source.reason === 'http-403' ||
        source.reason === 'http-404';

      return {
        kind: 'unavailable',
        reason: hasNoToken && isAuthOrNotFound ? 'no-access' : source.reason,
      };
    }

    return locateExcerpt(source.content, candidate.automationKey);
  }
}
