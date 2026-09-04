import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { RepoConnectionProvider } from '@qably/types';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IngestError,
  IngestOutcome,
  NormalizedScmEvent,
  ScmEventJob,
  ScmHeaders,
  ScmPayloadAdapter,
} from './ingestion.contracts';
import { INGESTION_QUEUE, SCM_ADAPTERS } from './ingestion.tokens';

const UNIQUE_VIOLATION = 'P2002';
const JOB_NAME = 'scm-event';

const KIND_COLUMN = {
  push: 'PUSH',
  pull_request: 'PULL_REQUEST',
} as const;

interface SecretCandidate {
  id: string;
  organizationId: string;
  encryptedWebhookSecret: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<ScmEventJob>,
    @Inject(SCM_ADAPTERS) private readonly adapters: ScmPayloadAdapter[],
  ) {}

  async ingest(
    provider: string,
    rawBody: string,
    headers: ScmHeaders,
  ): Promise<Result<IngestOutcome, IngestError>> {
    const adapter = this.adapterFor(provider);

    if (adapter === undefined) return err('unknown-provider');

    const payload = parseJson(rawBody);

    if (payload === undefined) return err('invalid-payload');

    const event = adapter.normalize(payload, headers);

    if (event === null) return ok('ignored');

    const connection = await this.verifiedConnection(
      adapter,
      event,
      rawBody,
      headers,
    );

    if (connection === null) return err('unverified');

    return this.store(event, connection);
  }

  private adapterFor(provider: string): ScmPayloadAdapter | undefined {
    const normalized = provider.toUpperCase() as RepoConnectionProvider;

    return this.adapters.find((entry) => entry.provider === normalized);
  }

  private async verifiedConnection(
    adapter: ScmPayloadAdapter,
    event: NormalizedScmEvent,
    rawBody: string,
    headers: ScmHeaders,
  ): Promise<SecretCandidate | null> {
    const candidates: SecretCandidate[] = await this.prisma.connection.findMany(
      {
        where: { provider: event.provider, repo: event.repo },
        select: {
          id: true,
          organizationId: true,
          encryptedWebhookSecret: true,
        },
      },
    );

    for (const candidate of candidates) {
      const secret = this.readSecret(candidate);

      if (secret === null) continue;

      if (adapter.verifySignature(rawBody, headers, secret)) return candidate;
    }

    return null;
  }

  private readSecret(candidate: SecretCandidate): string | null {
    try {
      return this.encryption.decrypt(candidate.encryptedWebhookSecret);
    } catch {
      this.logger.warn(
        `Connection ${candidate.id} holds a webhook secret this ENCRYPTION_KEY cannot decrypt`,
      );

      return null;
    }
  }

  private async store(
    event: NormalizedScmEvent,
    connection: SecretCandidate,
  ): Promise<Result<IngestOutcome, IngestError>> {
    let stored: { id: string };

    try {
      stored = await this.prisma.scmEvent.create({
        data: {
          connectionId: connection.id,
          organizationId: connection.organizationId,
          provider: event.provider,
          eventId: event.eventId,
          kind: KIND_COLUMN[event.kind],
          repo: event.repo,
          branch: event.branch,
          commitSha: event.commitSha,
          author: event.author,
          title: event.title,
          url: event.url,
          changedFiles: event.changedFiles,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return ok('duplicate');
      throw error;
    }

    await this.queue.add(
      JOB_NAME,
      { scmEventId: stored.id },
      {
        jobId: `${event.provider}:${event.eventId}`,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    return ok('accepted');
  }
}
