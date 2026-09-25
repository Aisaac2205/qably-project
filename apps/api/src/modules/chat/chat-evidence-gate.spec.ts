import { gate } from './chat-evidence-gate';

describe('chat-evidence-gate', () => {
  it('rejects a null outcome with no-code-evidence', () => {
    expect(gate(null)).toEqual({
      kind: 'no-code-evidence',
      reason: 'no-evidence',
    });
  });

  it('rejects an unavailable outcome, passing the reason through', () => {
    expect(gate({ kind: 'unavailable', reason: 'no-connection' })).toEqual({
      kind: 'no-code-evidence',
      reason: 'no-connection',
    });
  });

  it('rejects an unavailable outcome with a different reason unchanged', () => {
    expect(gate({ kind: 'unavailable', reason: 'http-404' })).toEqual({
      kind: 'no-code-evidence',
      reason: 'http-404',
    });
  });

  it('rejects a declaration excerpt that is empty after trim', () => {
    expect(
      gate({
        kind: 'declaration',
        excerpt: '   \n  ',
        startLine: 1,
        endLine: 2,
      }),
    ).toEqual({ kind: 'no-code-evidence', reason: 'empty-excerpt' });
  });

  it('rejects a file-head excerpt that is empty after trim', () => {
    expect(gate({ kind: 'file-head', excerpt: '' })).toEqual({
      kind: 'no-code-evidence',
      reason: 'empty-excerpt',
    });
  });

  it('accepts a declaration excerpt with real content', () => {
    expect(
      gate({
        kind: 'declaration',
        excerpt: 'it("rejects an expired card", () => {})',
        startLine: 10,
        endLine: 12,
      }),
    ).toEqual({
      kind: 'code-backed',
      excerpt: 'it("rejects an expired card", () => {})',
    });
  });

  it('accepts a file-head excerpt with real content', () => {
    expect(gate({ kind: 'file-head', excerpt: 'const x = 1;' })).toEqual({
      kind: 'code-backed',
      excerpt: 'const x = 1;',
    });
  });
});
