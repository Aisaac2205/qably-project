import type { Env } from '../../config/env';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmailSender, SendEmailInput } from '../mailer/mailer.contracts';
import { buildAuthOptions } from './auth.options';

function createSender(): EmailSender & {
  send: jest.Mock<Promise<void>, [SendEmailInput]>;
} {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function createPrisma(
  locale: string | null = null,
): Pick<PrismaService, 'user'> {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ locale }),
    },
  } as unknown as Pick<PrismaService, 'user'>;
}

const env = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://qably:qably@localhost:5432/qably',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_APP_URL: 'http://localhost:3000',
  ENCRYPTION_KEY: 'a'.repeat(64),
  GITHUB_CLIENT_ID: 'gh-client-id',
  GITHUB_CLIENT_SECRET: 'gh-client-secret',
} as Env;

const sender = createSender();
const prisma = createPrisma();

describe('buildAuthOptions', () => {
  it('trusts the web app origin so cross-origin auth calls are not rejected', () => {
    expect(buildAuthOptions(env, sender, prisma).trustedOrigins).toEqual([
      'http://localhost:3000',
    ]);
  });

  it('normalizes a web app url written with a trailing slash', () => {
    expect(
      buildAuthOptions(
        { ...env, WEB_APP_URL: 'http://localhost:3000/' },
        sender,
        prisma,
      ).trustedOrigins,
    ).toEqual(['http://localhost:3000']);
  });

  it('still serves auth from the api base url', () => {
    expect(buildAuthOptions(env, sender, prisma).baseURL).toBe(
      'http://localhost:3001',
    );
  });

  it('uses secure cookies only in production', () => {
    expect(
      buildAuthOptions(env, sender, prisma).advanced.useSecureCookies,
    ).toBe(false);
    expect(
      buildAuthOptions({ ...env, NODE_ENV: 'production' }, sender, prisma)
        .advanced.useSecureCookies,
    ).toBe(true);
  });
});

describe('buildAuthOptions provider credentials', () => {
  it('encrypts provider access tokens so a database dump does not hand over source code', () => {
    expect(
      buildAuthOptions(env, sender, prisma).account.encryptOAuthTokens,
    ).toBe(true);
  });

  it('asks github for repository access so the user can pick a repo without pasting a token', () => {
    expect(
      buildAuthOptions(env, sender, prisma).socialProviders.github.scope,
    ).toContain('repo');
  });

  it('allows linking a github account whose email differs from the signed-in user, for authenticated linking only', () => {
    expect(
      buildAuthOptions(env, sender, prisma).account.accountLinking
        .allowDifferentEmails,
    ).toBe(true);
  });

  it('leaves updateUserInfoOnLink off so a linked github profile cannot overwrite the account name or avatar', () => {
    const accountLinking = buildAuthOptions(env, sender, prisma).account
      .accountLinking as { updateUserInfoOnLink?: boolean };

    expect(accountLinking.updateUserInfoOnLink).not.toBe(true);
  });
});

describe('buildAuthOptions transactional email', () => {
  it('keeps requireEmailVerification false so signup is never blocked on it', () => {
    expect(
      buildAuthOptions(env, sender, prisma).emailAndPassword
        .requireEmailVerification,
    ).toBe(false);
  });

  it('wires sendResetPassword and delegates the reset email to the injected sender', async () => {
    const fakeSender = createSender();
    const options = buildAuthOptions(env, fakeSender, createPrisma('en'));

    await options.emailAndPassword.sendResetPassword({
      user: { id: 'user-1', email: 'user@qably.dev' },
      url: 'http://localhost:3000/reset-password?token=abc',
    });

    expect(fakeSender.send).toHaveBeenCalledTimes(1);
    const [call] = fakeSender.send.mock.calls[0];
    expect(call.to).toBe('user@qably.dev');
    expect(call.subject.length).toBeGreaterThan(0);
    expect(call.html).toContain(
      'http://localhost:3000/reset-password?token=abc',
    );
  });

  it('wires emailVerification.sendVerificationEmail and delegates to the injected sender', async () => {
    const fakeSender = createSender();
    const options = buildAuthOptions(env, fakeSender, createPrisma('en'));

    await options.emailVerification.sendVerificationEmail({
      user: { id: 'user-1', email: 'user@qably.dev' },
      url: 'http://localhost:3000/verify-email?token=abc',
    });

    expect(fakeSender.send).toHaveBeenCalledTimes(1);
    const [call] = fakeSender.send.mock.calls[0];
    expect(call.to).toBe('user@qably.dev');
    expect(call.subject.length).toBeGreaterThan(0);
    expect(call.html).toContain('http://localhost:3000/verify-email?token=abc');
  });
});
