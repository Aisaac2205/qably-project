import { en, es, type Locale } from '@qably/i18n';
import { escapeHtml } from './escape-html';

const dictionaries: Record<Locale, typeof en> = { en, es };

export interface EmailLayoutInput {
  locale: Locale;
  bodyHtml: string;
  footerVariant: 'auth' | 'notification';
  preferencesUrl?: string;
}

export function emailLayout({
  locale,
  bodyHtml,
  footerVariant,
  preferencesUrl,
}: EmailLayoutInput): string {
  const copy = dictionaries[locale].mailer.layout;
  const year = new Date().getFullYear();
  const copyright = copy.footerCopyright.replace('{{year}}', String(year));

  const footerNotice =
    footerVariant === 'auth'
      ? `<p style="font-size: 12px; color: #666; margin: 0 0 8px;">${copy.footerAuthNotice}</p>`
      : preferencesUrl === undefined
        ? ''
        : `<p style="font-size: 12px; color: #666; margin: 0 0 8px;">${copy.footerPreferencesText} <a href="${escapeHtml(preferencesUrl)}" style="color: #666;">${copy.footerPreferencesLinkText}</a></p>`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
      <div style="padding: 32px 24px 24px;">
        <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 24px;">${copy.brandName}</p>
        ${bodyHtml}
      </div>
      <div style="padding: 16px 24px 32px; border-top: 1px solid #e5e7eb;">
        ${footerNotice}
        <p style="font-size: 12px; color: #999; margin: 0;">${copyright}</p>
      </div>
    </div>
  `;
}
