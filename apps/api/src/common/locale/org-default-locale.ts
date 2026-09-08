import { resolveLocale, type Locale } from '@qably/i18n';
import type { PrismaService } from '../../prisma/prisma.service';

const OWNER_ROLE = 'owner';

export async function resolveOrgDefaultLocale(
  prisma: Pick<PrismaService, 'orgMember'>,
  organizationId: string,
): Promise<Locale> {
  const owner = await prisma.orgMember.findFirst({
    where: { organizationId, role: OWNER_ROLE },
    orderBy: { joinedAt: 'asc' },
    select: { user: { select: { locale: true } } },
  });

  return resolveLocale(owner?.user.locale);
}
