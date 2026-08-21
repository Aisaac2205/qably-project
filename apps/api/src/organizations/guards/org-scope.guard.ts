import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { isErr } from '../../common/result';
import {
  ORGANIZATION_HEADER,
  type RequestWithOrg,
} from '../organizations.contracts';
import { OrganizationsService } from '../organizations.service';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private readonly organizations: OrganizationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithOrg>();

    if (request.session === undefined) {
      throw new InternalServerErrorException(
        'OrgScopeGuard requires SessionGuard on the route',
      );
    }

    const requested = this.readRequestedOrganization(request);
    const result = await this.organizations.resolveContext(
      request.session.user,
      requested,
    );

    if (isErr(result)) {
      throw new ForbiddenException('You do not belong to that organization');
    }

    request.org = result.value;
    return true;
  }

  private readRequestedOrganization(
    request: RequestWithOrg,
  ): string | undefined {
    const raw = request.headers[ORGANIZATION_HEADER];

    if (typeof raw !== 'string') return undefined;

    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
  }
}
