import { organizationInviteEmail } from './organization-invite';

describe('organizationInviteEmail', () => {
  it('returns a non-empty subject', () => {
    const { subject } = organizationInviteEmail({
      url: 'https://app.qably.dev/invite/abc123',
      organizationName: 'Acme',
      inviterName: 'Ada Lovelace',
      locale: 'en',
    });

    expect(subject.length).toBeGreaterThan(0);
  });

  it('includes the given invite url in the html body', () => {
    const url = 'https://app.qably.dev/invite/abc123';
    const { html } = organizationInviteEmail({
      url,
      organizationName: 'Acme',
      inviterName: 'Ada Lovelace',
      locale: 'en',
    });

    expect(html).toContain(url);
  });

  it('escapes the organization and inviter name so user input cannot break the markup', () => {
    const { html } = organizationInviteEmail({
      url: 'https://app.qably.dev/invite/abc123',
      organizationName: '<script>alert(1)</script>',
      inviterName: '<b>Ada</b>',
      locale: 'en',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>Ada</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('localizes the subject and heading in Spanish', () => {
    const { subject, html } = organizationInviteEmail({
      url: 'https://app.qably.dev/invite/abc123',
      organizationName: 'Acme',
      inviterName: 'Ada Lovelace',
      locale: 'es',
    });

    expect(subject).toBe('Ada Lovelace te invitó a unirte a Acme en Qably');
    expect(html).toContain('Te invitaron a Acme');
  });
});
