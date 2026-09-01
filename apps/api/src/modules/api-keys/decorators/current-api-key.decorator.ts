import {
  createParamDecorator,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ApiKeyIdentity, RequestWithApiKey } from '../api-keys.contracts';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiKeyIdentity => {
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();

    if (request.apiKey === undefined) {
      throw new InternalServerErrorException(
        'CurrentApiKey requires ApiKeyGuard on the route',
      );
    }

    return request.apiKey;
  },
);
