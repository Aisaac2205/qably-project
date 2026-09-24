import { en, es, type Locale } from '@qably/i18n';
import { escapeHtml } from '../lib/escape-html';
import { emailLayout } from '../lib/email-layout';
import type { EmailTemplate } from './password-reset';

const dictionaries: Record<Locale, typeof en> = { en, es };

export interface OrganizationInviteEmailInput {
  url: string;
  organizationName: string;
  inviterName: string;
  locale: Locale;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}

export function organizationInviteEmail({
  url,
  organizationName,
  inviterName,
  locale,
}: OrganizationInviteEmailInput): EmailTemplate {
  const copy = dictionaries[locale].mailer.organizationInvite;
  const safeOrganizationName = escapeHtml(organizationName);
  const safeInviterName = escapeHtml(inviterName);
  const values = {
    organizationName: safeOrganizationName,
    inviterName: safeInviterName,
  };

  const bodyHtml = `
    <h1 style="font-size: 20px; margin: 0 0 16px; color: #111827;">${interpolate(copy.heading, values)}</h1>
    <p style="font-size: 14px; line-height: 1.5; color: #333;">
      ${interpolate(copy.body, values)}
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
    subject: interpolate(copy.subject, values),
    html: emailLayout({ locale, bodyHtml, footerVariant: 'auth' }),
  };
}
