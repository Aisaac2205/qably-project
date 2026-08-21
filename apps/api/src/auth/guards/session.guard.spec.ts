import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type RequestWithSession,
  type SessionContext,
  type SessionReader,
} from '../auth.contracts';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { SessionGuard } from './session.guard';

const session: SessionContext = {
  user: {
    id: 'user-1',
    email: 'qa@acme.test',
    name: 'Ada',
    emailVerified: true,
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

function createContext(request: RequestWithSession, handlerMeta?: boolean) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key) => (key === IS_PUBLIC ? handlerMeta : undefined));

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('SessionGuard', () => {
  function createGuard(read: jest.Mock, handlerMeta?: boolean) {
    const request: RequestWithSession = { headers: { cookie: 'x' } };
    const { context, reflector } = createContext(request, handlerMeta);
    const reader: SessionReader = { read: read as SessionReader['read'] };

    return { guard: new SessionGuard(reader, reflector), context, request };
  }

  it('allows the request and attaches the session when one is active', async () => {
    const { guard, context, request } = createGuard(
      jest.fn().mockResolvedValue(session),
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.session).toEqual(session);
  });

  it('rejects the request when no session is active', async () => {
    const { guard, context } = createGuard(jest.fn().mockResolvedValue(null));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects the request when the session reader fails', async () => {
    const { guard, context } = createGuard(
      jest.fn().mockRejectedValue(new Error('better-auth is unreachable')),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('never leaks the reader failure message to the caller', async () => {
    const { guard, context } = createGuard(
      jest.fn().mockRejectedValue(new Error('BETTER_AUTH_SECRET mismatch')),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      /^Authentication required$/,
    );
  });

  it('allows a public route without consulting the session reader', async () => {
    const read = jest.fn();
    const { guard, context } = createGuard(read, true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it('passes the incoming headers to the session reader', async () => {
    const read = jest.fn().mockResolvedValue(session);
    const { guard, context } = createGuard(read);

    await guard.canActivate(context);

    expect(read).toHaveBeenCalledWith({ cookie: 'x' });
  });
});
