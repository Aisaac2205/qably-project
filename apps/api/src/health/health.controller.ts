import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator';
import type { HealthReport } from './health.contracts';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): Promise<HealthReport> {
    return this.healthService.check();
  }
}
