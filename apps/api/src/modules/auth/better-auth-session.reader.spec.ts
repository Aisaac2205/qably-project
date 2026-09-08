jest.mock('better-auth/node', () => ({
  fromNodeHeaders: (headers: unknown) => headers,
}));
jest.mock('./auth.instance', () => ({
  AUTH_INSTANCE: Symbol('AUTH_INSTANCE'),
}));

import { BetterAuthSessionReader } from './better-auth-session.reader';
import type { AuthInstance } from './auth.instance';

const sessionUser = {
  id: 'user-1',
  email: 'qa@acme.test',
  name: 'QA',
  emailVerified: true,
};

const sessionRow = {
  id: 'session-1',
  expiresAt: new Date('2026-09-10T00:00:00.000Z'),
};

function fakeAuth(
  getSession: jest.Mock = jest
    .fn()
    .mockResolvedValue({ user: sessionUser, session: sessionRow }),
): AuthInstance {
  return { api: { getSession } } as unknown as AuthInstance;
}

interface FakePrisma {
  user: { findUnique: jest.Mock };
}

function fakePrisma(locale: string | null = 'es'): FakePrisma {
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ locale }) },
  };
}

function build(
  auth: AuthInstance,
  prisma: FakePrisma,
): BetterAuthSessionReader {
  return new BetterAuthSessionReader(auth, prisma as never);
}

describe('BetterAuthSessionReader', () => {
  it('reads the persisted locale from Prisma and attaches it to the session user', async () => {
    const prisma = fakePrisma('es');
    const reader = build(fakeAuth(), prisma);

    const result = await reader.read({});

    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'qa@acme.test',
        name: 'QA',
        emailVerified: true,
        locale: 'es',
      },
      sessionId: 'session-1',
      expiresAt: sessionRow.expiresAt,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('returns a null locale when the user has no preference recorded', async () => {
    const reader = build(fakeAuth(), fakePrisma(null));

    const result = await reader.read({});

    expect(result?.user.locale).toBeNull();
  });

  it('returns null without touching Prisma when there is no session', async () => {
    const prisma = fakePrisma();
    const reader = build(fakeAuth(jest.fn().mockResolvedValue(null)), prisma);

    const result = await reader.read({});

    expect(result).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
