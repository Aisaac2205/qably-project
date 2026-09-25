import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isErr, type Result } from '../../../common/result';
import type { LastDecisionView, ReviewError } from '../review.contracts';

export async function unwrapDecision<T>(
  result: Result<T, ReviewError>,
  lastDecision: () => Promise<LastDecisionView | null>,
): Promise<T> {
  if (isErr(result) && result.error === 'invalid-transition') {
    const decision = await lastDecision();
    throw new ConflictException({
      code: 'invalid-transition',
      message: 'This proposal was already decided',
      decision,
    });
  }

  return unwrap(result);
}

export function unwrap<T>(result: Result<T, ReviewError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'Proposal not found',
      });
    case 'invalid-transition':
      throw new ConflictException({
        code: result.error,
        message: 'This proposal was already decided',
      });
    case 'missing-evidence':
      throw new UnprocessableEntityException({
        code: result.error,
        message: 'The evidence backing this proposal is no longer available',
      });
    case 'incomplete-proposal':
      throw new UnprocessableEntityException({
        code: result.error,
        message:
          'This proposal documents no steps, so there is nothing to publish',
      });
    case 'missing-suite':
      throw new UnprocessableEntityException({
        code: result.error,
        message: 'This project has no suite to publish the official case into',
      });
    case 'name-taken':
      throw new ConflictException({
        code: result.error,
        message: 'Another official case in this suite already uses that title',
      });
  }
}
