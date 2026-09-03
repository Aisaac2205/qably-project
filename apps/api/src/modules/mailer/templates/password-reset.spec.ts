import { passwordResetEmail } from './password-reset';

describe('passwordResetEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = passwordResetEmail({
      url: 'https://app.qably.dev/reset-password?token=abc123',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the given reset url in the html body', () => {
    const url = 'https://app.qably.dev/reset-password?token=abc123';
    const { html } = passwordResetEmail({ url });

    expect(html).toContain(url);
  });
});
