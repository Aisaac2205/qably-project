import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { RequestWithOrg } from '../../organizations/organizations.contracts';
import { AiEntitlementService } from '../ai-entitlement.service';

@Injectable()
export class AiEntitlementGuard implements CanActivate {
  constructor(private readonly entitlement: AiEntitlementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithOrg>();

    if (request.org === undefined) {
      throw new InternalServerErrorException(
        'AiEntitlementGuard requires OrgScopeGuard on the route',
      );
    }

    const entitled = await this.entitlement.isEntitled(
      request.org.organizationId,
    );

    if (!entitled) {
      throw new ForbiddenException({
        code: 'ai-not-enabled',
        message: 'AI features are not enabled for this organization',
      });
    }

    return true;
  }
}
