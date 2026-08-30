import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  NormalizedScmEvent,
  ScmHeaders,
  ScmPayloadAdapter,
} from '../ingestion.contracts';

const SIGNATURE_HEADER = 'x-hub-signature';
const EVENT_HEADER = 'x-event-key';
const REQUEST_HEADER = 'x-request-uuid';
const PUSH_EVENT = 'repo:push';
const PULL_REQUEST_EVENTS = ['pullrequest:created', 'pullrequest:updated'];

interface Target {
  hash?: string;
  message?: string;
  links?: { html?: { href?: string } };
}

interface PushPayload {
  actor?: { display_name?: string };
  repository?: { full_name?: string };
  push?: { changes?: { new?: { name?: string; target?: Target } | null }[] };
}

interface PullRequestPayload {
  actor?: { display_name?: string };
  repository?: { full_name?: string };
  pullrequest?: {
    title?: string;
    source?: { branch?: { name?: string }; commit?: { hash?: string } };
    links?: { html?: { href?: string } };
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

@Injectable()
export class BitbucketAdapter implements ScmPayloadAdapter {
  readonly provider = 'BITBUCKET' as const;

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
    const eventId = headers[REQUEST_HEADER];
    const eventKey = headers[EVENT_HEADER] ?? '';

    if (body === null || eventId === undefined) return null;

    if (eventKey === PUSH_EVENT) {
      return this.fromPush(body, eventId);
    }

    if (PULL_REQUEST_EVENTS.includes(eventKey)) {
      return this.fromPullRequest(body, eventId);
    }

    return null;
  }

  private fromPush(
    payload: PushPayload,
    eventId: string,
  ): NormalizedScmEvent | null {
    const change = payload.push?.changes?.[0]?.new;
    const repo = payload.repository?.full_name;

    if (!change?.target?.hash || repo === undefined) return null;

    return {
      eventId,
      provider: this.provider,
      kind: 'push',
      repo,
      branch: change.name ?? '',
      commitSha: change.target.hash,
      author: payload.actor?.display_name ?? 'unknown',
      title: change.target.message ?? '',
      url: change.target.links?.html?.href ?? '',
      changedFiles: [],
    };
  }

  private fromPullRequest(
    payload: PullRequestPayload,
    eventId: string,
  ): NormalizedScmEvent | null {
    const pull = payload.pullrequest;
    const repo = payload.repository?.full_name;
    const commitSha = pull?.source?.commit?.hash;

    if (commitSha === undefined || repo === undefined) return null;

    return {
      eventId,
      provider: this.provider,
      kind: 'pull_request',
      repo,
      branch: pull?.source?.branch?.name ?? '',
      commitSha,
      author: payload.actor?.display_name ?? 'unknown',
      title: pull?.title ?? '',
      url: pull?.links?.html?.href ?? '',
      changedFiles: [],
    };
  }
}
