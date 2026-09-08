jest.mock('better-auth/node', () => ({
  toNodeHandler: () => jest.fn(),
}));
jest.mock('./auth.instance', () => ({
  AUTH_INSTANCE: Symbol('AUTH_INSTANCE'),
}));

import { AuthController } from './auth.controller';
import type { AuthInstance } from './auth.instance';
import type { AuthenticatedUser } from './auth.contracts';

interface FakePrisma {
  user: { update: jest.Mock };
}

function fakePrisma(): FakePrisma {
  return { user: { update: jest.fn().mockResolvedValue({}) } };
}

function fakeAuth(): AuthInstance {
  return {} as AuthInstance;
}

function build(prisma: FakePrisma = fakePrisma()): AuthController {
  return new AuthController(fakeAuth(), prisma as never);
}

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'qa@acme.test',
  name: 'QA',
  emailVerified: true,
  locale: null,
};

describe('AuthController.me', () => {
  it('returns the current user including their locale', () => {
    const controller = build();

    expect(controller.me(user)).toEqual(user);
  });
});

describe('AuthController.updateMe', () => {
  it('persists the chosen locale and returns the updated user', async () => {
    const prisma = fakePrisma();
    const controller = build(prisma);

    const result = await controller.updateMe(user, { locale: 'es' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { locale: 'es' },
    });
    expect(result).toEqual({ ...user, locale: 'es' });
  });
});
