import { notificationDigestEmail } from './notification-digest';

describe('notificationDigestEmail', () => {
  it('uses the given subject as-is, not a generic fallback', () => {
    const { subject } = notificationDigestEmail({
      locale: 'en',
      subject: 'Run "Checkout regression" failed',
      message: 'The run "Checkout regression" in Checkout failed.',
    });

    expect(subject).toBe('Run "Checkout regression" failed');
  });

  it('includes the rendered message in the html body', () => {
    const { html } = notificationDigestEmail({
      locale: 'en',
      subject: 'Run failed',
      message: 'The run Checkout regression in Checkout failed.',
    });

    expect(html).toContain('The run Checkout regression in Checkout failed.');
  });

  it('escapes markup coming from the message', () => {
    const { html } = notificationDigestEmail({
      locale: 'en',
      subject: 'Run failed',
      message: "The run <a href='https://phish.example'>click</a> failed.",
    });

    expect(html).not.toContain("<a href='https://phish.example'>");
    expect(html).toContain('&lt;a href=&#39;https://phish.example&#39;&gt;');
  });

  it('escapes a script tag coming from the message', () => {
    const { html } = notificationDigestEmail({
      locale: 'en',
      subject: 'Run failed',
      message: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes quotes coming from the message', () => {
    const { html } = notificationDigestEmail({
      locale: 'en',
      subject: 'Run failed',
      message: 'The run "Checkout regression" failed.',
    });

    expect(html).toContain('&quot;Checkout regression&quot;');
  });

  it('includes a link to notification preferences when a preferencesUrl is given', () => {
    const { html } = notificationDigestEmail({
      locale: 'en',
      subject: 'Run failed',
      message: 'The run failed.',
      preferencesUrl: 'https://app.qably.dev/settings',
    });

    expect(html).toContain('https://app.qably.dev/settings');
  });

  it('localizes the layout copy in Spanish', () => {
    const { html } = notificationDigestEmail({
      locale: 'es',
      subject: 'La ejecución falló',
      message: 'La ejecución falló.',
      preferencesUrl: 'https://app.qably.dev/settings',
    });

    expect(html).toContain('Preferencias de notificaciones');
    expect(html).toContain('Todos los derechos reservados');
  });
});
