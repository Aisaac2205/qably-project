import { Injectable } from '@nestjs/common';
import type { DatabaseProbe } from '../health/health.contracts';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaDatabaseProbe implements DatabaseProbe {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
