import type { Locale } from '@qably/i18n';
import { escapeHtml } from '../lib/escape-html';
import { emailLayout } from '../lib/email-layout';
import type { EmailTemplate } from './password-reset';

export interface NotificationDigestEmailInput {
  locale: Locale;
  subject: string;
  message: string;
  preferencesUrl?: string;
}

export function notificationDigestEmail({
  locale,
  subject,
  message,
  preferencesUrl,
}: NotificationDigestEmailInput): EmailTemplate {
  const bodyHtml = `
    <h1 style="font-size: 20px; margin: 0 0 16px; color: #111827;">${escapeHtml(subject)}</h1>
    <p style="font-size: 14px; line-height: 1.5; color: #333;">
      ${escapeHtml(message)}
    </p>
  `;

  return {
    subject,
    html: emailLayout({
      locale,
      bodyHtml,
      footerVariant: 'notification',
      preferencesUrl,
    }),
  };
}
