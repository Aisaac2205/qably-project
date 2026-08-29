import { Inject, Injectable } from '@nestjs/common';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { err, ok, type Result } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REPO_DIRECTORY,
  type AvailableRepoView,
  type ConnectionError,
  type ConnectionView,
  type ConnectionWithSecretView,
  type RepoDirectory,
  type WebhookSecretResult,
} from './connections.contracts';
import type {
  CreateConnectionInput,
  UpdateConnectionInput,
} from './connections.schemas';

const UNIQUE_VIOLATION = 'P2002';

const SELECT = {
  id: true,
  organizationId: true,
  provider: true,
  name: true,
  repo: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface ConnectionRow {
  id: string;
  organizationId: string;
  provider: 'GITHUB' | 'BITBUCKET';
  name: string;
  repo: string;
  createdAt: Date;
  updatedAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function toView(row: ConnectionRow): ConnectionView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    name: row.name,
    repo: row.repo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function canWrite(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @Inject(REPO_DIRECTORY) private readonly repos: RepoDirectory,
  ) {}

  listAvailableRepos(userId: string): Promise<AvailableRepoView[]> {
    return this.repos.listForUser(userId);
  }

  async list(org: OrgContext): Promise<ConnectionView[]> {
    const rows = await this.prisma.connection.findMany({
      where: { organizationId: org.organizationId },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });

    return rows.map(toView);
  }

  async findOne(
    org: OrgContext,
    id: string,
  ): Promise<Result<ConnectionView, ConnectionError>> {
    const row = await this.scoped(org, id);

    return row === null ? err('not-found') : ok(toView(row));
  }

  async create(
    org: OrgContext,
    input: CreateConnectionInput,
  ): Promise<Result<ConnectionWithSecretView, ConnectionError>> {
    if (!canWrite(org)) return err('forbidden');

    const webhookSecret = this.encryption.generateSecret();

    try {
      const row = await this.prisma.connection.create({
        data: {
          provider: input.provider,
          name: input.name,
          repo: input.repo,
          encryptedWebhookSecret: this.encryption.encrypt(webhookSecret),
          organizationId: org.organizationId,
        },
        select: SELECT,
      });

      return ok({ ...toView(row), webhookSecret });
    } catch (error) {
      if (isUniqueViolation(error)) return err('duplicate');
      throw error;
    }
  }

  async rotateWebhookSecret(
    org: OrgContext,
    id: string,
  ): Promise<Result<WebhookSecretResult, ConnectionError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    const webhookSecret = this.encryption.generateSecret();

    await this.prisma.connection.update({
      where: { id },
      data: { encryptedWebhookSecret: this.encryption.encrypt(webhookSecret) },
    });

    return ok({ webhookSecret });
  }

  async update(
    org: OrgContext,
    id: string,
    input: UpdateConnectionInput,
  ): Promise<Result<ConnectionView, ConnectionError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    const row = await this.prisma.connection.update({
      where: { id },
      data: input,
      select: SELECT,
    });

    return ok(toView(row));
  }

  async remove(
    org: OrgContext,
    id: string,
  ): Promise<Result<void, ConnectionError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.scoped(org, id);

    if (existing === null) return err('not-found');

    await this.prisma.connection.delete({ where: { id } });

    return ok(undefined);
  }

  private scoped(org: OrgContext, id: string): Promise<ConnectionRow | null> {
    return this.prisma.connection.findFirst({
      where: { id, organizationId: org.organizationId },
      select: SELECT,
    });
  }
}
