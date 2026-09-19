import { resolveLocale, type Locale } from '@qably/i18n';
import type { PrismaService } from '../../prisma/prisma.service';

export async function resolveUserLocale(
  prisma: Pick<PrismaService, 'user'>,
  userId: string,
): Promise<Locale> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });

  return resolveLocale(row?.locale);
}
