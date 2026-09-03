import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('neutralises an anchor tag used for phishing', () => {
    expect(escapeHtml("<a href='https://phish.example'>Ver reporte</a>")).toBe(
      '&lt;a href=&#39;https://phish.example&#39;&gt;Ver reporte&lt;/a&gt;',
    );
  });

  it('escapes an ampersand exactly once', () => {
    expect(escapeHtml('Checkout & Payments')).toBe('Checkout &amp; Payments');
  });

  it('does not double escape an existing entity', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes double and single quotes', () => {
    expect(escapeHtml(`"run" 'case'`)).toBe('&quot;run&quot; &#39;case&#39;');
  });

  it('leaves text without special characters untouched', () => {
    expect(escapeHtml('Checkout regression')).toBe('Checkout regression');
  });

  it('returns an empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});
