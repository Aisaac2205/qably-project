import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import type { HealthReport } from './health.contracts';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  check(): Promise<HealthReport> {
    return this.healthService.check();
  }
}
