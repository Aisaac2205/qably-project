import type { PrismaClient } from '../../generated/prisma/client';
import { seedReviewInboxBench } from './seed';

describe('seedReviewInboxBench', () => {
  it('refuses a non-local database url before touching prisma', async () => {
    const untouchedPrisma = new Proxy(
      {},
      {
        get() {
          throw new Error(
            'seedReviewInboxBench must not touch Prisma before validating the URL',
          );
        },
      },
    ) as PrismaClient;

    await expect(
      seedReviewInboxBench(
        untouchedPrisma,
        'postgresql://user:pass@containers-us-west-1.railway.app:5432/railway',
      ),
    ).rejects.toThrow(/localhost or 127\.0\.0\.1/);
  });
});
