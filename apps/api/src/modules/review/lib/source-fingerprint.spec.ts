import {
  fingerprintSource,
  type SourceFingerprintParts,
} from './source-fingerprint';

const parts: SourceFingerprintParts = {
  promptVersion: 'extraction-v12',
  model: 'gemini-3.1-flash-lite',
  locale: 'en',
  truncationLimit: null,
  content: "it('adds an item', () => {});\n",
};

describe('fingerprintSource', () => {
  it('returns a 64-character hex SHA-256 digest', () => {
    expect(fingerprintSource(parts)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same parts', () => {
    expect(fingerprintSource({ ...parts })).toBe(fingerprintSource(parts));
  });

  it('changes when a single character of the content changes', () => {
    const edited = { ...parts, content: parts.content.replace('adds', 'add') };

    expect(fingerprintSource(edited)).not.toBe(fingerprintSource(parts));
  });

  it('changes with the prompt version, so a new prompt re-extracts every file', () => {
    const next = { ...parts, promptVersion: 'extraction-v13' };

    expect(fingerprintSource(next)).not.toBe(fingerprintSource(parts));
  });

  it('changes with the model, so a new model re-extracts every file', () => {
    const next = { ...parts, model: 'gemini-3.2-pro' };

    expect(fingerprintSource(next)).not.toBe(fingerprintSource(parts));
  });

  it('changes with the locale, so the proposals are written in the new language', () => {
    const next = { ...parts, locale: 'es' };

    expect(fingerprintSource(next)).not.toBe(fingerprintSource(parts));
  });

  it('changes with the limit a truncated file was cut at', () => {
    const cut = { ...parts, truncationLimit: 60_000 };
    const cutLater = { ...parts, truncationLimit: 1_000_000 };

    expect(fingerprintSource(cut)).not.toBe(fingerprintSource(parts));
    expect(fingerprintSource(cutLater)).not.toBe(fingerprintSource(cut));
  });

  it('does not let a part bleed into its neighbour', () => {
    const left = fingerprintSource({
      ...parts,
      promptVersion: 'v1',
      model: 'm',
    });
    const right = fingerprintSource({
      ...parts,
      promptVersion: 'v1m',
      model: '',
    });

    expect(left).not.toBe(right);
  });

  it('hashes an empty file', () => {
    expect(fingerprintSource({ ...parts, content: '' })).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
