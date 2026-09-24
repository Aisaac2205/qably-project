import { Injectable } from '@nestjs/common';
import { PLAN_LIMITS, type Plan } from '@qably/types';
import { Prisma } from '../../../generated/prisma/client';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';

export interface OrganizationLockClient {
  $queryRaw: PrismaService['$queryRaw'];
}

export interface ProjectAllowanceClient extends OrganizationLockClient {
  project: { count: PrismaService['project']['count'] };
}

export interface SeatAllowanceClient extends OrganizationLockClient {
  orgMember: { count: PrismaService['orgMember']['count'] };
  orgInvite: { count: PrismaService['orgInvite']['count'] };
}

@Injectable()
export class PlanEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async lockPlan(
    organizationId: string,
    tx: OrganizationLockClient = this.prisma,
  ): Promise<Plan> {
    const rows = await tx.$queryRaw<{ plan: Plan }[]>(
      Prisma.sql`SELECT plan FROM "organization" WHERE id = ${organizationId} FOR UPDATE`,
    );

    const plan = rows[0]?.plan;

    if (plan === undefined) {
      throw new Error(
        `organization ${organizationId} not found while locking plan`,
      );
    }

    return plan;
  }

  async ensureProjectAllowance(
    organizationId: string,
    tx: ProjectAllowanceClient = this.prisma,
  ): Promise<Result<void, 'plan-limit-reached'>> {
    const plan = await this.lockPlan(organizationId, tx);
    const limit = PLAN_LIMITS[plan].projects;

    if (limit === null) return ok(undefined);

    const used = await tx.project.count({ where: { organizationId } });

    return used < limit ? ok(undefined) : err('plan-limit-reached');
  }

  async countSeats(
    organizationId: string,
    tx: SeatAllowanceClient = this.prisma,
    now: Date = new Date(),
  ): Promise<number> {
    const [members, pendingInvites] = await Promise.all([
      tx.orgMember.count({ where: { organizationId } }),
      tx.orgInvite.count({
        where: {
          organizationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
    ]);

    return members + pendingInvites;
  }

  async ensureSeatAllowance(
    organizationId: string,
    tx: SeatAllowanceClient = this.prisma,
    now: Date = new Date(),
  ): Promise<Result<void, 'seat-limit-reached'>> {
    const plan = await this.lockPlan(organizationId, tx);
    const used = await this.countSeats(organizationId, tx, now);

    return used < PLAN_LIMITS[plan].members
      ? ok(undefined)
      : err('seat-limit-reached');
  }
}
