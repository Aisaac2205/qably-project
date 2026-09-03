import { escapeHtml } from '../lib/escape-html';

export interface PasswordResetEmailInput {
  url: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function passwordResetEmail({
  url,
}: PasswordResetEmailInput): EmailTemplate {
  return {
    subject: 'Reset your Qably password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Reset your password</h1>
        <p style="font-size: 14px; line-height: 1.5; color: #333;">
          We received a request to reset the password for your Qably account.
          Click the button below to choose a new one.
        </p>
        <p style="margin: 24px 0;">
          <a href="${escapeHtml(url)}" style="display: inline-block; padding: 10px 20px; background-color: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Reset password
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">
          If you did not request this, you can safely ignore this email.
        </p>
        <p style="font-size: 12px; color: #666; word-break: break-all;">
          ${escapeHtml(url)}
        </p>
      </div>
    `,
  };
}
