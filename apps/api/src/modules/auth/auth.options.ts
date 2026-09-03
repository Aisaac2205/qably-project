import { resolveAllowedOrigins } from '../../config/origins';
import type { Env } from '../../config/env';
import type { EmailSender } from '../mailer/mailer.contracts';
import { passwordResetEmail } from '../mailer/templates/password-reset';
import { verifyEmailEmail } from '../mailer/templates/verify-email';

export function buildAuthOptions(env: Env, mailer: EmailSender) {
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: resolveAllowedOrigins(env.WEB_APP_URL),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: false,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) => {
        const { subject, html } = passwordResetEmail({ url });
        await mailer.send({ to: user.email, subject, html });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) => {
        const { subject, html } = verifyEmailEmail({ url });
        await mailer.send({ to: user.email, subject, html });
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: ['repo'] as string[],
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === 'production',
    },
  } as const;
}
