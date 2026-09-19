import { passwordResetEmail } from './password-reset';

describe('passwordResetEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = passwordResetEmail({
      url: 'https://app.qably.dev/reset-password?token=abc123',
      locale: 'en',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the given reset url in the html body', () => {
    const url = 'https://app.qably.dev/reset-password?token=abc123';
    const { html } = passwordResetEmail({ url, locale: 'en' });

    expect(html).toContain(url);
  });

  it('localizes the subject and heading in Spanish', () => {
    const { subject, html } = passwordResetEmail({
      url: 'https://app.qably.dev/reset-password?token=abc123',
      locale: 'es',
    });

    expect(subject).toBe('Restablecé tu contraseña de Qably');
    expect(html).toContain('Restablecé tu contraseña');
  });
});
