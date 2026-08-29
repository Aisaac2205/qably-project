import {
  createParamDecorator,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import type { OrgContext, RequestWithOrg } from '../organizations.contracts';

export const CurrentOrg = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrgContext => {
    const request = context.switchToHttp().getRequest<RequestWithOrg>();

    if (request.org === undefined) {
      throw new InternalServerErrorException(
        'CurrentOrg requires OrgScopeGuard on the route',
      );
    }

    return request.org;
  },
);
