import { Module } from '@nestjs/common';
import { PrismaDatabaseProbe } from '../prisma/prisma-database.probe';
import { HealthController } from './health.controller';
import { DATABASE_PROBE } from './health.contracts';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: DATABASE_PROBE, useClass: PrismaDatabaseProbe },
  ],
})
export class HealthModule {}
