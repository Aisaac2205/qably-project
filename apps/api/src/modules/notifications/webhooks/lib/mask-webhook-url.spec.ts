import { maskWebhookUrl } from './mask-webhook-url';

describe('maskWebhookUrl', () => {
  it('exposes the host and the last four characters of a slack url', () => {
    expect(
      maskWebhookUrl('https://hooks.slack.com/services/T00/B00/abcd1234wxyz'),
    ).toBe('hooks.slack.com/••••wxyz');
  });

  it('exposes the host and the last four characters of a discord url', () => {
    expect(
      maskWebhookUrl('https://discord.com/api/webhooks/123456789/token-abcd'),
    ).toBe('discord.com/••••abcd');
  });

  it('never contains the full path or token', () => {
    const masked = maskWebhookUrl(
      'https://hooks.slack.com/services/T00/B00/super-secret-token',
    );

    expect(masked).not.toContain('super-secret-token');
    expect(masked).not.toContain('/services/');
  });
});
