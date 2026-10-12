import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { runSnapshotBackfillCli } from './lib/backfill-run-case-snapshots.cli';
import { createPrismaSnapshotBackfillPort } from './lib/backfill-run-case-snapshots.prisma-port';

void runSnapshotBackfillCli({
  argv: process.argv,
  env: process.env,
  openPort: (databaseUrl) => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    return {
      port: createPrismaSnapshotBackfillPort(prisma),
      close: () => prisma.$disconnect(),
    };
  },
  log: (line) => console.log(line),
  logError: (error) => console.error(error),
}).then((code) => process.exit(code));
