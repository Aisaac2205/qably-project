import {
  createParamDecorator,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedUser, RequestWithSession } from '../auth.contracts';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithSession>();

    if (request.session === undefined) {
      throw new InternalServerErrorException(
        'CurrentUser requires SessionGuard on the route',
      );
    }

    return request.session.user;
  },
);
