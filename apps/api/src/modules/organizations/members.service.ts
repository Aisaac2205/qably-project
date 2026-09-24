import { Injectable } from '@nestjs/common';
import type { OrgMember, OrgRole } from '@qably/types';
import { err, ok, type Result } from '../../common/result';
import { PrismaService } from '../../prisma/prisma.service';
import type { MemberManageError } from './members.contracts';
import type { OrgContext } from './organizations.contracts';
import { PlanEntitlementsService } from './plan-entitlements.service';

const OWNER_ROLE: OrgRole = 'owner';

const MEMBER_SELECT = {
  id: true,
  userId: true,
  role: true,
  joinedAt: true,
  user: { select: { name: true, email: true, image: true } },
} as const;

interface MemberRow {
  id: string;
  userId: string;
  role: OrgRole;
  joinedAt: Date;
  user: { name: string; email: string; image: string | null };
}

function canManageMembers(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

function toSummary(row: MemberRow): OrgMember {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
    ...(row.user.image === null ? {} : { avatarUrl: row.user.image }),
  };
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async listMembers(
    org: OrgContext,
  ): Promise<Result<OrgMember[], MemberManageError>> {
    if (!canManageMembers(org)) return err('forbidden');

    const rows = await this.prisma.orgMember.findMany({
      where: { organizationId: org.organizationId },
      orderBy: { joinedAt: 'asc' },
      select: MEMBER_SELECT,
    });

    return ok(rows.map(toSummary));
  }

  async changeRole(
    org: OrgContext,
    memberId: string,
    role: OrgRole,
  ): Promise<Result<OrgMember, MemberManageError>> {
    if (!canManageMembers(org)) return err('forbidden');

    return this.prisma.$transaction(async (tx) => {
      await this.entitlements.lockPlan(org.organizationId, tx);

      const target: MemberRow | null = await tx.orgMember.findFirst({
        where: { id: memberId, organizationId: org.organizationId },
        select: MEMBER_SELECT,
      });
      if (target === null) return err('not-found');

      const touchesOwnership =
        target.role === OWNER_ROLE || role === OWNER_ROLE;
      if (touchesOwnership && org.role !== OWNER_ROLE) return err('forbidden');

      if (target.role === OWNER_ROLE && role !== OWNER_ROLE) {
        const ownerCount = await tx.orgMember.count({
          where: { organizationId: org.organizationId, role: OWNER_ROLE },
        });
        if (ownerCount <= 1) return err('last-owner-required');
      }

      const updated: MemberRow = await tx.orgMember.update({
        where: { id: memberId },
        data: { role },
        select: MEMBER_SELECT,
      });

      return ok(toSummary(updated));
    });
  }

  async removeMember(
    org: OrgContext,
    memberId: string,
  ): Promise<Result<void, MemberManageError>> {
    if (!canManageMembers(org)) return err('forbidden');

    return this.prisma.$transaction(async (tx) => {
      await this.entitlements.lockPlan(org.organizationId, tx);

      const target = await tx.orgMember.findFirst({
        where: { id: memberId, organizationId: org.organizationId },
        select: { id: true, role: true },
      });
      if (target === null) return err('not-found');

      if (target.role === OWNER_ROLE) {
        if (org.role !== OWNER_ROLE) return err('forbidden');

        const ownerCount = await tx.orgMember.count({
          where: { organizationId: org.organizationId, role: OWNER_ROLE },
        });
        if (ownerCount <= 1) return err('last-owner-required');
      }

      await tx.orgMember.delete({ where: { id: memberId } });
      return ok(undefined);
    });
  }
}
