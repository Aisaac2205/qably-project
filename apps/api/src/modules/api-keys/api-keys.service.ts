import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ApiKeyError,
  ApiKeyIdentity,
  ApiKeyView,
  ApiKeyWithSecretView,
} from './api-keys.contracts';
import type { CreateApiKeyInput } from './api-keys.schemas';
import {
  API_KEY_PREFIX,
  generateApiKeyToken,
  hashApiKeySecret,
  parseApiKeyToken,
  secretMatches,
} from './lib/token';

const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

const SELECT = {
  id: true,
  projectId: true,
  organizationId: true,
  name: true,
  lookupId: true,
  lastFour: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

interface ApiKeyRow {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  lookupId: string;
  lastFour: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

interface AuthenticationRow extends ApiKeyRow {
  hashedSecret: string;
}

function toView(row: ApiKeyRow): ApiKeyView {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    prefix: `${API_KEY_PREFIX}_${row.lookupId}`,
    lastFour: row.lastFour,
    createdAt: row.createdAt.toISOString(),
    ...(row.lastUsedAt === null
      ? {}
      : { lastUsedAt: row.lastUsedAt.toISOString() }),
    ...(row.revokedAt === null
      ? {}
      : { revokedAt: row.revokedAt.toISOString() }),
  };
}

function canWrite(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

function shouldRecordUsage(lastUsedAt: Date | null, now: Date): boolean {
  if (lastUsedAt === null) return true;

  return now.getTime() - lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    org: OrgContext,
    projectId: string,
  ): Promise<Result<ApiKeyView[], ApiKeyError>> {
    if (!(await this.projectExists(org, projectId))) return err('not-found');

    const rows = await this.prisma.apiKey.findMany({
      where: { projectId, organizationId: org.organizationId },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });

    return ok(rows.map(toView));
  }

  async create(
    org: OrgContext,
    projectId: string,
    input: CreateApiKeyInput,
  ): Promise<Result<ApiKeyWithSecretView, ApiKeyError>> {
    if (!canWrite(org)) return err('forbidden');
    if (!(await this.projectExists(org, projectId))) return err('not-found');

    const generated = generateApiKeyToken();

    const row = await this.prisma.apiKey.create({
      data: {
        projectId,
        organizationId: org.organizationId,
        name: input.name,
        lookupId: generated.lookupId,
        hashedSecret: hashApiKeySecret(generated.secret),
        lastFour: generated.lastFour,
      },
      select: SELECT,
    });

    return ok({ ...toView(row), token: generated.token });
  }

  async revoke(
    org: OrgContext,
    projectId: string,
    id: string,
  ): Promise<Result<ApiKeyView, ApiKeyError>> {
    if (!canWrite(org)) return err('forbidden');

    const existing = await this.prisma.apiKey.findFirst({
      where: { id, projectId, organizationId: org.organizationId },
      select: SELECT,
    });

    if (existing === null) return err('not-found');

    const row = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: SELECT,
    });

    return ok(toView(row));
  }

  async authenticate(token: string): Promise<ApiKeyIdentity | null> {
    const parsed = parseApiKeyToken(token);

    if (parsed === null) return null;

    const row: AuthenticationRow | null = await this.prisma.apiKey.findUnique({
      where: { lookupId: parsed.lookupId },
      select: { ...SELECT, hashedSecret: true },
    });

    if (row === null) return null;
    if (row.revokedAt !== null) return null;
    if (!secretMatches(parsed.secret, row.hashedSecret)) return null;

    await this.recordUsage(row);

    return {
      apiKeyId: row.id,
      projectId: row.projectId,
      organizationId: row.organizationId,
    };
  }

  private async recordUsage(row: AuthenticationRow): Promise<void> {
    const now = new Date();

    if (!shouldRecordUsage(row.lastUsedAt, now)) return;

    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: now },
    });
  }

  private async projectExists(
    org: OrgContext,
    projectId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: org.organizationId },
      select: { id: true },
    });

    return project !== null;
  }
}
