import { BadRequestException, NotFoundException } from '@nestjs/common';
import { isErr, type Result } from '../../../common/result';
import type { DashboardError } from '../dashboard.contracts';

export function unwrapDashboardError<T>(result: Result<T, DashboardError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'project-not-found':
      throw new NotFoundException('Project not found');
    case 'invalid-time-zone':
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ path: 'tz', message: 'Invalid IANA time zone' }],
      });
  }
}
