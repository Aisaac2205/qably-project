import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AiEntitlementGuard } from './ai-entitlement.guard';

function contextFor(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AiEntitlementGuard', () => {
  const isEntitled = jest.fn();
  const guard = new AiEntitlementGuard({ isEntitled } as never);

  beforeEach(() => {
    isEntitled.mockReset();
  });

  it('allows the request when the organization is entitled', async () => {
    isEntitled.mockResolvedValue(true);
    const request = { org: { organizationId: 'org-1' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(isEntitled).toHaveBeenCalledWith('org-1');
  });

  it('rejects with a coded ForbiddenException when not entitled', async () => {
    isEntitled.mockResolvedValue(false);
    const request = { org: { organizationId: 'org-1' } };

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      response: {
        code: 'ai-not-enabled',
      },
    });
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails loudly when OrgScopeGuard did not run first', async () => {
    isEntitled.mockResolvedValue(true);

    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(isEntitled).not.toHaveBeenCalled();
  });
});
