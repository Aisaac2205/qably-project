import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import type { EmailSender, SendEmailInput } from './mailer.contracts';

@Injectable()
export class MailerService implements EmailSender {
  private readonly logger = new Logger(MailerService.name);
  private readonly client: Resend | null;
  private readonly from: string | undefined;

  constructor(@InjectEnv() env: Env) {
    this.client =
      env.RESEND_API_KEY === undefined ? null : new Resend(env.RESEND_API_KEY);
    this.from = env.RESEND_FROM_EMAIL;
  }

  async send(input: SendEmailInput): Promise<void> {
    if (this.client === null) {
      this.logger.warn(
        `RESEND_API_KEY is not configured; skipped email to ${input.to}`,
      );
      return;
    }

    const response = await this.client.emails.send({
      from: this.from ?? '',
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (response.error !== null) {
      throw new Error(response.error.message);
    }
  }
}
