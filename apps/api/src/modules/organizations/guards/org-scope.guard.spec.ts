import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { err, ok } from '../../../common/result';
import { OrgScopeGuard } from './org-scope.guard';

const session = {
  user: {
    id: 'user-1',
    email: 'ada@acme.test',
    name: 'Ada',
    emailVerified: true,
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

function contextFor(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OrgScopeGuard', () => {
  const resolveContext = jest.fn();
  const guard = new OrgScopeGuard({ resolveContext } as never);

  beforeEach(() => {
    resolveContext.mockReset();
  });

  it('attaches the resolved organization to the request', async () => {
    const context = { organizationId: 'org-1', slug: 'acme', role: 'owner' };
    resolveContext.mockResolvedValue(ok(context));
    const request = { session, headers: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('org', context);
  });

  it('passes an explicit organization header through to the service', async () => {
    resolveContext.mockResolvedValue(
      ok({ organizationId: 'org-2', slug: 'other', role: 'member' }),
    );

    await guard.canActivate(
      contextFor({ session, headers: { 'x-organization-id': 'org-2' } }),
    );

    expect(resolveContext).toHaveBeenCalledWith(session.user, 'org-2');
  });

  it('rejects an organization the caller does not belong to', async () => {
    resolveContext.mockResolvedValue(err('not-a-member'));

    await expect(
      guard.canActivate(
        contextFor({ session, headers: { 'x-organization-id': 'org-x' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails loudly when the session guard did not run first', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('ignores a blank organization header instead of treating it as a request', async () => {
    resolveContext.mockResolvedValue(
      ok({ organizationId: 'org-1', slug: 'acme', role: 'owner' }),
    );

    await guard.canActivate(
      contextFor({ session, headers: { 'x-organization-id': '  ' } }),
    );

    expect(resolveContext).toHaveBeenCalledWith(session.user, undefined);
  });
});
