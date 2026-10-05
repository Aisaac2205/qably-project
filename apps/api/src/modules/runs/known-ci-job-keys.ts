import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const KNOWN_JOB_KEY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const KNOWN_JOB_KEY_TTL_MS = 60 * 1000;

interface CachedJobKeys {
  keys: readonly string[];
  expiresAt: number;
}

@Injectable()
export class KnownCiJobKeys {
  private readonly cache = new Map<string, CachedJobKeys>();

  constructor(private readonly prisma: PrismaService) {}

  async forProject(projectId: string): Promise<readonly string[]> {
    const now = Date.now();
    const cached = this.cache.get(projectId);
    if (cached !== undefined && cached.expiresAt > now) return cached.keys;

    const keys = await this.read(projectId, now);
    this.cache.set(projectId, { keys, expiresAt: now + KNOWN_JOB_KEY_TTL_MS });

    return keys;
  }

  private async read(projectId: string, now: number): Promise<string[]> {
    const rows = await this.prisma.run.groupBy({
      by: ['ciJobKey'],
      where: {
        projectId,
        ciJobKey: { not: null },
        startedAt: { gte: new Date(now - KNOWN_JOB_KEY_WINDOW_MS) },
      },
    });

    return rows.flatMap((row) => (row.ciJobKey === null ? [] : [row.ciJobKey]));
  }
}
