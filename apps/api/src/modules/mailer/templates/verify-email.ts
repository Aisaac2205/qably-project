import { escapeHtml } from '../lib/escape-html';
import type { EmailTemplate } from './password-reset';

export interface VerifyEmailEmailInput {
  url: string;
}

export function verifyEmailEmail({
  url,
}: VerifyEmailEmailInput): EmailTemplate {
  return {
    subject: 'Verify your Qably email address',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Verify your email</h1>
        <p style="font-size: 14px; line-height: 1.5; color: #333;">
          Confirm this is your email address to finish setting up your Qably account.
        </p>
        <p style="margin: 24px 0;">
          <a href="${escapeHtml(url)}" style="display: inline-block; padding: 10px 20px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Verify email
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">
          If you did not create a Qably account, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #666; word-break: break-all;">
          ${escapeHtml(url)}
        </p>
      </div>
    `,
  };
}
