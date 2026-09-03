import type { EmailTemplate } from './password-reset';

export interface NotificationDigestEmailInput {
  message: string;
}

export function notificationDigestEmail({
  message,
}: NotificationDigestEmailInput): EmailTemplate {
  return {
    subject: 'Qably notification',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Qably notification</h1>
        <p style="font-size: 14px; line-height: 1.5; color: #333;">
          ${message}
        </p>
      </div>
    `,
  };
}
