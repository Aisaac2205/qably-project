import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { err, ok, type Result } from '../common/result';
import { PrismaService } from '../prisma/prisma.service';
import { toSlug, withSlugSuffix } from './lib/slug';
import type {
  OrgContext,
  OrganizationSummary,
  OrgResolutionError,
} from './organizations.contracts';

const MAX_SLUG_ATTEMPTS = 5;
const UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

function personalOrganizationName(user: AuthenticatedUser): string {
  const displayName = user.name.trim() || user.email.split('@')[0];

  return `${displayName}'s workspace`;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveContext(
    user: AuthenticatedUser,
    requestedOrganizationId?: string,
  ): Promise<Result<OrgContext, OrgResolutionError>> {
    const membership = await this.prisma.orgMember.findFirst({
      where:
        requestedOrganizationId === undefined
          ? { userId: user.id }
          : { userId: user.id, organizationId: requestedOrganizationId },
      orderBy: { joinedAt: 'asc' },
      select: {
        organizationId: true,
        role: true,
        organization: { select: { slug: true } },
      },
    });

    if (membership !== null) {
      return ok({
        organizationId: membership.organizationId,
        slug: membership.organization.slug,
        role: membership.role,
      });
    }

    if (requestedOrganizationId !== undefined) {
      return err('not-a-member');
    }

    return ok(await this.bootstrapPersonalOrganization(user));
  }

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      role: membership.role,
    }));
  }

  private async bootstrapPersonalOrganization(
    user: AuthenticatedUser,
  ): Promise<OrgContext> {
    const name = personalOrganizationName(user);
    const base = toSlug(name);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      try {
        const organization = await this.createWithOwner(
          user.id,
          name,
          withSlugSuffix(base, attempt),
        );

        this.logger.log(
          `Bootstrapped organization ${organization.slug} for user ${user.id}`,
        );

        return {
          organizationId: organization.id,
          slug: organization.slug,
          role: 'owner',
        };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    throw new Error(
      `Could not allocate a unique slug for user ${user.id} after ${MAX_SLUG_ATTEMPTS} attempts`,
    );
  }

  private createWithOwner(
    userId: string,
    name: string,
    slug: string,
  ): Promise<{ id: string; slug: string }> {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name, slug },
        select: { id: true, slug: true },
      });

      await tx.orgMember.create({
        data: { organizationId: organization.id, userId, role: 'owner' },
      });

      return organization;
    });
  }
}
