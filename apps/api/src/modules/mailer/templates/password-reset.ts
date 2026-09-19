import { en, es, type Locale } from '@qably/i18n';
import { escapeHtml } from '../lib/escape-html';
import { emailLayout } from '../lib/email-layout';

const dictionaries: Record<Locale, typeof en> = { en, es };

export interface PasswordResetEmailInput {
  url: string;
  locale: Locale;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function passwordResetEmail({
  url,
  locale,
}: PasswordResetEmailInput): EmailTemplate {
  const copy = dictionaries[locale].mailer.passwordReset;

  const bodyHtml = `
    <h1 style="font-size: 20px; margin: 0 0 16px; color: #111827;">${copy.heading}</h1>
    <p style="font-size: 14px; line-height: 1.5; color: #333;">
      ${copy.body}
    </p>
    <p style="margin: 24px 0;">
      <a href="${escapeHtml(url)}" style="display: inline-block; padding: 10px 20px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
        ${copy.cta}
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      ${copy.disclaimer}
    </p>
    <p style="font-size: 12px; color: #666; word-break: break-all;">
      ${escapeHtml(url)}
    </p>
  `;

  return {
    subject: copy.subject,
    html: emailLayout({ locale, bodyHtml, footerVariant: 'auth' }),
  };
}
