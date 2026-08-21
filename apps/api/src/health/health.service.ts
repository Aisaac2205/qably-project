import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DATABASE_PROBE,
  type DatabaseProbe,
  type HealthReport,
} from './health.contracts';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(DATABASE_PROBE) private readonly database: DatabaseProbe,
  ) {}

  async check(): Promise<HealthReport> {
    const database = await this.probeDatabase();

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async probeDatabase(): Promise<'up' | 'down'> {
    try {
      await this.database.ping();
      return 'up';
    } catch (error) {
      this.logger.error(
        'Database probe failed',
        error instanceof Error ? error.stack : undefined,
      );
      return 'down';
    }
  }
}
