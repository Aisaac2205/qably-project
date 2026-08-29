import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { RequestWithApiKey } from '../api-keys.contracts';
import { ApiKeyGuard } from './api-key.guard';

const identity = {
  apiKeyId: 'key-1',
  projectId: 'project-1',
  organizationId: 'org-1',
};

function contextFor(request: Partial<RequestWithApiKey>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function build(authenticate: jest.Mock) {
  return new ApiKeyGuard({ authenticate } as never);
}

describe('ApiKeyGuard', () => {
  it('rejects a request without an authorization header', async () => {
    const authenticate = jest.fn();

    await expect(
      build(authenticate).canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects an authorization scheme that is not bearer', async () => {
    const authenticate = jest.fn();

    await expect(
      build(authenticate).canActivate(
        contextFor({ headers: { authorization: 'Basic qbly_a_b' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects a key the service does not recognise', async () => {
    const authenticate = jest.fn().mockResolvedValue(null);

    await expect(
      build(authenticate).canActivate(
        contextFor({ headers: { authorization: 'Bearer qbly_dead_beef' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('never accepts a browser session in place of a key', async () => {
    const authenticate = jest.fn().mockResolvedValue(null);

    await expect(
      build(authenticate).canActivate(
        contextFor({
          headers: {},
          session: { user: { id: 'user-1' } },
        } as Partial<RequestWithApiKey>),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the identity resolved from the key to the request', async () => {
    const authenticate = jest.fn().mockResolvedValue(identity);
    const request: Partial<RequestWithApiKey> = {
      headers: { authorization: 'Bearer qbly_dead_beef' },
    };

    const allowed = await build(authenticate).canActivate(contextFor(request));

    expect(allowed).toBe(true);
    expect(request.apiKey).toEqual(identity);
    expect(authenticate).toHaveBeenCalledWith('qbly_dead_beef');
  });
});
