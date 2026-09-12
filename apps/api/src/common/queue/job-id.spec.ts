import { buildJobId } from './job-id';

describe('buildJobId', () => {
  it('never contains a colon for a realistic Windows-style file path', () => {
    const id = buildJobId('document-file', [
      'proj-1',
      'C:\\repo\\src\\cart.spec.ts',
      0,
    ]);

    expect(id).not.toContain(':');
  });

  it('never contains a colon for a path with spaces and accented characters', () => {
    const id = buildJobId('document-file', [
      'proj-1',
      '/repo/tests/café menú/checkout.spec.ts',
      2,
    ]);

    expect(id).not.toContain(':');
  });

  it('never contains a colon for a very long path', () => {
    const longPath = `/repo/${'segment/'.repeat(200)}file.spec.ts`;

    const id = buildJobId('document-file', ['proj-1', longPath, 0]);

    expect(id).not.toContain(':');
    expect(id.length).toBeLessThan(200);
  });

  it('never contains any character BullMQ rejects', () => {
    const id = buildJobId('document-file', ['proj-1', 'a:b/c\\d e é', 5]);

    expect(/[^a-zA-Z0-9_-]/.test(id)).toBe(false);
  });

  it('is deterministic across repeated calls with the same components', () => {
    const first = buildJobId('code-change', ['change-1']);
    const second = buildJobId('code-change', ['change-1']);

    expect(first).toBe(second);
  });

  it('never collapses two tuples the old sanitize-in-place approach would have collapsed', () => {
    const withColons = buildJobId('ingest', ['proj', 'a', 'b']);
    const alreadyDashed = buildJobId('ingest', ['proj-a-b']);

    expect(withColons).not.toBe(alreadyDashed);
  });

  it('is injective across tuples that only differ in where a boundary falls', () => {
    const first = buildJobId('ingest', ['ab', 'c']);
    const second = buildJobId('ingest', ['a', 'bc']);

    expect(first).not.toBe(second);
  });

  it('is injective across tuples that only differ by component type', () => {
    const asNumber = buildJobId('document-file', ['proj-1', 'file.ts', 1]);
    const asString = buildJobId('document-file', ['proj-1', 'file.ts', '1']);

    expect(asNumber).not.toBe(asString);
  });

  it('keeps a readable kind prefix so ids stay greppable in a queue dashboard', () => {
    const id = buildJobId('document-case', ['case-1']);

    expect(id.startsWith('document-case-')).toBe(true);
  });

  it('rejects a kind that itself contains an unsafe character', () => {
    expect(() => buildJobId('bad:kind', ['x'])).toThrow();
  });
});
