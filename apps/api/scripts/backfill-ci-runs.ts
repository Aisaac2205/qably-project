import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { runBackfillCli } from './lib/backfill-ci-runs.cli';
import { createPrismaBackfillPort } from './lib/backfill-ci-runs.prisma-port';

void runBackfillCli({
  argv: process.argv,
  env: process.env,
  openPort: (databaseUrl) => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    return {
      port: createPrismaBackfillPort(prisma),
      close: () => prisma.$disconnect(),
    };
  },
  log: (line) => console.log(line),
  logError: (error) => console.error(error),
}).then((code) => process.exit(code));
