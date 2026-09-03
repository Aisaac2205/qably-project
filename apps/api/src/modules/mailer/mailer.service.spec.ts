import { Logger } from '@nestjs/common';
import type { Env } from '../../config/env';
import { MailerService } from './mailer.service';

const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send },
  })),
}));

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    RESEND_API_KEY: undefined,
    RESEND_FROM_EMAIL: 'Qably <alerts@qably.dev>',
    ...overrides,
  } as Env;
}

beforeEach(() => {
  send.mockReset();
});

describe('MailerService.send without RESEND_API_KEY', () => {
  it('resolves without throwing and logs a warning instead of calling Resend', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new MailerService(buildEnv({ RESEND_API_KEY: undefined }));

    await expect(
      service.send({
        to: 'user@qably.dev',
        subject: 'Reset your password',
        html: '<p>Reset it</p>',
      }),
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('MailerService.send with RESEND_API_KEY', () => {
  it('calls the Resend client with the resolved from, to, subject and html', async () => {
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const service = new MailerService(
      buildEnv({
        RESEND_API_KEY: 're_test',
        RESEND_FROM_EMAIL: 'Qably <alerts@qably.dev>',
      }),
    );

    await service.send({
      to: 'user@qably.dev',
      subject: 'Reset your password',
      html: '<p>Reset it</p>',
    });

    expect(send).toHaveBeenCalledWith({
      from: 'Qably <alerts@qably.dev>',
      to: 'user@qably.dev',
      subject: 'Reset your password',
      html: '<p>Reset it</p>',
    });
  });

  it('propagates a Resend API error instead of swallowing it', async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        message: 'Domain not verified',
        statusCode: 403,
        name: 'validation_error',
      },
    });
    const service = new MailerService(buildEnv({ RESEND_API_KEY: 're_test' }));

    await expect(
      service.send({
        to: 'user@qably.dev',
        subject: 'Reset your password',
        html: '<p>Reset it</p>',
      }),
    ).rejects.toThrow('Domain not verified');
  });
});
