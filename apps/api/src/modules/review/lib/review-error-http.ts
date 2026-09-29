import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ReviewApprovalConflictCode } from '@qably/types';
import { isErr, type Result } from '../../../common/result';
import type {
  ApprovalConflict,
  ApprovalError,
  LastDecisionView,
} from '../review.contracts';

const CONFLICT_MESSAGES: Readonly<Record<ReviewApprovalConflictCode, string>> =
  {
    'name-taken': 'Another official case in this suite already uses that title',
    'automation-key-taken':
      'Another official case in this suite already runs as that automated test',
    'publish-conflict':
      'Publishing collided with another change to the official cases. Try again',
  };

function toConflictException(conflict: ApprovalConflict): ConflictException {
  return new ConflictException({
    code: conflict.code,
    message: CONFLICT_MESSAGES[conflict.code],
    conflictingCase: conflict.conflictingCase,
  });
}

export async function unwrapDecision<T>(
  result: Result<T, ApprovalError>,
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

export function unwrap<T>(result: Result<T, ApprovalError>): T {
  if (!isErr(result)) return result.value;

  if (typeof result.error === 'object') {
    throw toConflictException(result.error);
  }

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
  }
}
