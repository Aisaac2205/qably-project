import { verifyEmailEmail } from './verify-email';

describe('verifyEmailEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = verifyEmailEmail({
      url: 'https://app.qably.dev/verify-email?token=abc123',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the given verification url in the html body', () => {
    const url = 'https://app.qably.dev/verify-email?token=abc123';
    const { html } = verifyEmailEmail({ url });

    expect(html).toContain(url);
  });
});
