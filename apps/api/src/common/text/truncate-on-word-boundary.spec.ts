import { truncateOnWordBoundary } from './truncate-on-word-boundary';

const ELLIPSIS = String.fromCharCode(0x2026);

describe('truncateOnWordBoundary', () => {
  it('returns the value unchanged when it already fits', () => {
    const value = 'Agregar un producto al carrito';

    expect(truncateOnWordBoundary(value, value.length)).toBe(value);
  });

  it('never exceeds the limit, counting the ellipsis it appends', () => {
    const value = 'palabra '.repeat(100).trim();

    const result = truncateOnWordBoundary(value, 120);

    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith(ELLIPSIS)).toBe(true);
  });

  it('cuts at the last whitespace before the limit instead of inside a word', () => {
    const value =
      'Verifica que el carrito recalcula el total cuando se agrega un producto con descuento';

    const result = truncateOnWordBoundary(value, 40);

    expect(result).toBe(`Verifica que el carrito recalcula el${ELLIPSIS}`);
  });

  it('keeps every word that fits when the limit lands right before a space', () => {
    const value = 'uno dos tres cuatro';

    expect(truncateOnWordBoundary(value, 8)).toBe(`uno dos${ELLIPSIS}`);
  });

  it('hard-cuts a long token that has no whitespace near the limit', () => {
    const token = 'a'.repeat(200);
    const value = `short ${token}`;

    const result = truncateOnWordBoundary(value, 100);

    expect(result).toHaveLength(100);
    expect(result).toBe(`${value.slice(0, 99)}${ELLIPSIS}`);
  });

  it('cuts at a newline boundary inside a multi-line code excerpt', () => {
    const value = [
      "it('does not spend a credit when AI is disabled', async () => {",
      '  prisma.organization.updateMany.mockResolvedValue({ count: 0 });',
      '  await expect(service.spendCredit(ORG_ID)).resolves.toBe(false);',
      '});',
    ].join('\n');

    const result = truncateOnWordBoundary(value, 70);

    expect(result.length).toBeLessThanOrEqual(70);
    expect(result).toBe(
      `it('does not spend a credit when AI is disabled', async () => {${ELLIPSIS}`,
    );
  });

  it('never splits a surrogate pair and stays within the UTF-16 limit zod checks', () => {
    const emoji = String.fromCodePoint(0x1f600);
    const value = `${'b'.repeat(118)}${emoji}${emoji}${emoji}`;

    const result = truncateOnWordBoundary(value, 120);

    expect(result.length).toBeLessThanOrEqual(120);
    expect(result).toBe(`${'b'.repeat(118)}${ELLIPSIS}`);
    expect(() => encodeURIComponent(result)).not.toThrow();
  });

  it('drops trailing whitespace before appending the ellipsis', () => {
    const value = `${'c'.repeat(50)}      ${'d'.repeat(50)}`;

    const result = truncateOnWordBoundary(value, 56);

    expect(result).toBe(`${'c'.repeat(50)}${ELLIPSIS}`);
  });
});
