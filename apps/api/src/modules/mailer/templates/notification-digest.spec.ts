import { notificationDigestEmail } from './notification-digest';

describe('notificationDigestEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = notificationDigestEmail({
      message: 'The run "Checkout regression" in Checkout failed.',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the rendered message in the html body', () => {
    const { html } = notificationDigestEmail({
      message: 'The run Checkout regression in Checkout failed.',
    });

    expect(html).toContain('The run Checkout regression in Checkout failed.');
  });

  it('escapes markup coming from the message', () => {
    const { html } = notificationDigestEmail({
      message: "The run <a href='https://phish.example'>click</a> failed.",
    });

    expect(html).not.toContain("<a href='https://phish.example'>");
    expect(html).toContain('&lt;a href=&#39;https://phish.example&#39;&gt;');
  });

  it('escapes a script tag coming from the message', () => {
    const { html } = notificationDigestEmail({
      message: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes quotes coming from the message', () => {
    const { html } = notificationDigestEmail({
      message: 'The run "Checkout regression" failed.',
    });

    expect(html).toContain('&quot;Checkout regression&quot;');
  });
});
