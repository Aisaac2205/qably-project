import { Injectable, Logger } from '@nestjs/common';
import { resolveLocale, type Locale } from '@qably/i18n';
import type {
  InvitePreviewRecord,
  OrgInviteStatus,
  OrgRole,
} from '@qably/types';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { err, isErr, ok, type Result } from '../../common/result';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { EmailSender } from '../mailer/mailer.contracts';
import { MailerService } from '../mailer/mailer.service';
import { organizationInviteEmail } from '../mailer/templates/organization-invite';
import type { OrgContext } from '../organizations/organizations.contracts';
import { PlanEntitlementsService } from '../organizations/plan-entitlements.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateInviteResult,
  InviteAcceptError,
  InviteCreateError,
  InviteManageError,
  InvitePreviewError,
  OrgInviteSummary,
} from './invites.contracts';
import type { CreateInviteInput } from './invites.schemas';
import { generateInviteToken, hashInviteToken } from './lib/invite-token';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SUMMARY_SELECT = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  expiresAt: true,
  invitedBy: { select: { name: true } },
} as const;

interface InviteSummaryRow {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: Date;
  expiresAt: Date;
  invitedBy: { name: string } | null;
}

class InviteClaimConflict extends Error {
  constructor() {
    super('invite is no longer pending');
  }
}

function canManageInvites(org: OrgContext): boolean {
  return org.role === 'owner' || org.role === 'admin';
}

function toSummary(row: InviteSummaryRow): OrgInviteSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    invitedByName: row.invitedBy?.name ?? null,
  };
}

function resolveInviteStatus(
  invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): OrgInviteStatus {
  if (invite.acceptedAt !== null) return 'accepted';
  if (invite.revokedAt !== null) return 'revoked';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';

  return 'pending';
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly mailer: MailerService,
    @InjectEnv() private readonly env: Env,
  ) {}

  async createInvite(
    org: OrgContext,
    inviter: AuthenticatedUser,
    input: CreateInviteInput,
  ): Promise<Result<CreateInviteResult, InviteCreateError>> {
    if (!canManageInvites(org)) return err('forbidden');

    const now = new Date();
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

    const claim = await this.prisma.$transaction(async (tx) => {
      const allowance = await this.entitlements.ensureSeatAllowance(
        org.organizationId,
        tx,
        now,
      );
      if (isErr(allowance)) return err('seat-limit-reached' as const);

      const existingMember = await tx.orgMember.findFirst({
        where: {
          organizationId: org.organizationId,
          user: { email: { equals: input.email, mode: 'insensitive' } },
        },
        select: { id: true },
      });
      if (existingMember !== null) return err('already-member' as const);

      const existingInvite = await tx.orgInvite.findFirst({
        where: {
          organizationId: org.organizationId,
          email: input.email,
          acceptedAt: null,
          revokedAt: null,
        },
        select: { id: true },
      });

      const row: InviteSummaryRow =
        existingInvite === null
          ? await tx.orgInvite.create({
              data: {
                organizationId: org.organizationId,
                email: input.email,
                role: input.role,
                tokenHash,
                expiresAt,
                invitedById: inviter.id,
              },
              select: SUMMARY_SELECT,
            })
          : await tx.orgInvite.update({
              where: { id: existingInvite.id },
              data: {
                role: input.role,
                tokenHash,
                expiresAt,
                invitedById: inviter.id,
              },
              select: SUMMARY_SELECT,
            });

      return ok(row);
    });

    if (isErr(claim)) return claim;

    const organizationName = await this.organizationName(org.organizationId);
    const emailDelivered = await this.sendInviteEmail({
      to: input.email,
      token,
      organizationName,
      inviter,
    });

    return ok({ ...toSummary(claim.value), emailDelivered });
  }

  async listInvites(
    org: OrgContext,
  ): Promise<Result<OrgInviteSummary[], InviteManageError>> {
    if (!canManageInvites(org)) return err('forbidden');

    const rows = await this.prisma.orgInvite.findMany({
      where: {
        organizationId: org.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: SUMMARY_SELECT,
    });

    return ok(rows.map(toSummary));
  }

  async revokeInvite(
    org: OrgContext,
    inviteId: string,
  ): Promise<Result<void, InviteManageError>> {
    if (!canManageInvites(org)) return err('forbidden');

    const claim = await this.prisma.orgInvite.updateMany({
      where: {
        id: inviteId,
        organizationId: org.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return claim.count === 0 ? err('not-found') : ok(undefined);
  }

  async resendInvite(
    org: OrgContext,
    inviter: AuthenticatedUser,
    inviteId: string,
  ): Promise<Result<CreateInviteResult, InviteManageError>> {
    if (!canManageInvites(org)) return err('forbidden');

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const claim = await this.prisma.orgInvite.updateMany({
      where: {
        id: inviteId,
        organizationId: org.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { tokenHash, expiresAt },
    });

    if (claim.count === 0) return err('not-found');

    const row = await this.prisma.orgInvite.findUnique({
      where: { id: inviteId },
      select: SUMMARY_SELECT,
    });

    if (row === null) return err('not-found');

    const organizationName = await this.organizationName(org.organizationId);
    const emailDelivered = await this.sendInviteEmail({
      to: row.email,
      token,
      organizationName,
      inviter,
    });

    return ok({ ...toSummary(row), emailDelivered });
  }

  async previewInvite(
    token: string,
  ): Promise<Result<InvitePreviewRecord, InvitePreviewError>> {
    const tokenHash = hashInviteToken(token);
    const invite = await this.prisma.orgInvite.findUnique({
      where: { tokenHash },
      select: {
        email: true,
        role: true,
        acceptedAt: true,
        revokedAt: true,
        expiresAt: true,
        organization: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (invite === null) return err('invite-invalid-or-used');

    return ok({
      organizationName: invite.organization.name,
      inviterName: invite.invitedBy?.name ?? '',
      email: invite.email,
      role: invite.role,
      status: resolveInviteStatus(invite, new Date()),
    });
  }

  async acceptInvite(
    token: string,
    user: AuthenticatedUser,
  ): Promise<Result<{ organizationId: string }, InviteAcceptError>> {
    const tokenHash = hashInviteToken(token);
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const invite = await tx.orgInvite.findUnique({ where: { tokenHash } });

        if (
          invite === null ||
          invite.acceptedAt !== null ||
          invite.revokedAt !== null
        ) {
          return err('invite-invalid-or-used');
        }
        if (invite.expiresAt.getTime() <= now.getTime()) {
          return err('invite-expired');
        }
        if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
          return err('invite-email-mismatch');
        }

        const allowance = await this.entitlements.ensureSeatAllowance(
          invite.organizationId,
          tx,
          now,
        );
        if (isErr(allowance)) return err('seat-limit-reached');

        const claim = await tx.orgInvite.updateMany({
          where: { id: invite.id, acceptedAt: null, revokedAt: null },
          data: { acceptedAt: now },
        });
        if (claim.count === 0) throw new InviteClaimConflict();

        await tx.orgMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: invite.organizationId,
              userId: user.id,
            },
          },
          create: {
            organizationId: invite.organizationId,
            userId: user.id,
            role: invite.role,
          },
          update: {},
        });

        return ok({ organizationId: invite.organizationId });
      });
    } catch (error) {
      if (error instanceof InviteClaimConflict) {
        return err('invite-invalid-or-used');
      }
      throw error;
    }
  }

  private async organizationName(organizationId: string): Promise<string> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    return organization?.name ?? '';
  }

  private async sendInviteEmail(input: {
    to: string;
    token: string;
    organizationName: string;
    inviter: AuthenticatedUser;
  }): Promise<boolean> {
    const sender: EmailSender = this.mailer;

    try {
      const locale = await this.resolveRecipientLocale(input.to, input.inviter);
      const url = `${this.env.WEB_APP_URL}/invite/${input.token}`;
      const { subject, html } = organizationInviteEmail({
        url,
        organizationName: input.organizationName,
        inviterName: input.inviter.name,
        locale,
      });

      await sender.send({ to: input.to, subject, html });
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to deliver invite email to ${input.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private async resolveRecipientLocale(
    email: string,
    inviter: AuthenticatedUser,
  ): Promise<Locale> {
    const recipient = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { locale: true },
    });

    return resolveLocale(recipient?.locale ?? inviter.locale);
  }
}
