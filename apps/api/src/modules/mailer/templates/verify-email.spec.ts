import { verifyEmailEmail } from './verify-email';

describe('verifyEmailEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = verifyEmailEmail({
      url: 'https://app.qably.dev/verify-email?token=abc123',
      locale: 'en',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the given verification url in the html body', () => {
    const url = 'https://app.qably.dev/verify-email?token=abc123';
    const { html } = verifyEmailEmail({ url, locale: 'en' });

    expect(html).toContain(url);
  });

  it('localizes the subject and heading in Spanish', () => {
    const { subject, html } = verifyEmailEmail({
      url: 'https://app.qably.dev/verify-email?token=abc123',
      locale: 'es',
    });

    expect(subject).toBe('Verificá tu dirección de correo de Qably');
    expect(html).toContain('Verificá tu correo');
  });
});
