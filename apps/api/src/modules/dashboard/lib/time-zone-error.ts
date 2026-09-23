import { Prisma } from '../../../../generated/prisma/client';

const UNKNOWN_TIME_ZONE_SQLSTATE = '22023';

export function isUnknownTimeZoneError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2010') return false;

  const meta = error.meta;
  const sqlState = typeof meta?.code === 'string' ? meta.code : undefined;
  const dbMessage =
    typeof meta?.message === 'string' ? meta.message : error.message;

  return (
    sqlState === UNKNOWN_TIME_ZONE_SQLSTATE &&
    dbMessage.toLowerCase().includes('time zone')
  );
}
