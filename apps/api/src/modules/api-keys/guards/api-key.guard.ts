import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { API_KEY_SCHEME, type RequestWithApiKey } from '../api-keys.contracts';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const token = this.readToken(request);

    if (token === null) throw new UnauthorizedException('Api key required');

    const identity = await this.apiKeys.authenticate(token);

    if (identity === null) throw new UnauthorizedException('Api key required');

    request.apiKey = identity;
    return true;
  }

  private readToken(request: RequestWithApiKey): string | null {
    const raw = request.headers.authorization;

    if (typeof raw !== 'string') return null;

    const [scheme, token] = raw.split(' ');

    if (scheme !== API_KEY_SCHEME) return null;
    if (token === undefined || token.trim() === '') return null;

    return token.trim();
  }
}
