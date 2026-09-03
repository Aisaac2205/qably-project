import { notificationDigestEmail } from './notification-digest';

describe('notificationDigestEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = notificationDigestEmail({
      message: 'The run "Checkout regression" in Checkout failed.',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the rendered message in the html body', () => {
    const message = 'The run "Checkout regression" in Checkout failed.';
    const { html } = notificationDigestEmail({ message });

    expect(html).toContain(message);
  });
});
