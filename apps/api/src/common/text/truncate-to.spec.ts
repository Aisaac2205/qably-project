import { truncateTo } from './truncate-to';

describe('truncateTo', () => {
  it('returns the value unchanged when it is within the limit', () => {
    expect(truncateTo('short', 10)).toBe('short');
  });

  it('cuts the value down to the limit', () => {
    expect(truncateTo('x'.repeat(200), 120)).toHaveLength(120);
  });

  it('truncates on code points so a surrogate pair is never split', () => {
    const emoji = String.fromCodePoint(0x1f600);
    const value = `${'a'.repeat(119)}${emoji}${emoji}`;

    const result = truncateTo(value, 120);

    expect(Array.from(result)).toHaveLength(120);
    expect(result.endsWith(emoji)).toBe(true);
  });
});
