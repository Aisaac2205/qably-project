import { SUITE_SUMMARY_RESPONSE_JSON_SCHEMA } from './gemini.extractor';

function collectKeys(node: unknown, path: string[] = []): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) =>
      collectKeys(item, [...path, String(index)]),
    );
  }
  if (typeof node !== 'object' || node === null) return [];

  return Object.entries(node).flatMap(([key, value]) => [
    [...path, key].join('.'),
    ...collectKeys(value, [...path, key]),
  ]);
}

describe('SUITE_SUMMARY_RESPONSE_JSON_SCHEMA', () => {
  const keys = collectKeys(SUITE_SUMMARY_RESPONSE_JSON_SCHEMA);

  it('carries no string length limits, which the provider rejects as too many states', () => {
    expect(keys.some((key) => key.endsWith('.maxLength'))).toBe(false);
    expect(keys.some((key) => key.endsWith('.minLength'))).toBe(false);
  });

  it('carries no array length limits on the tags array', () => {
    const arrayLimits = keys.filter(
      (key) => key.endsWith('.maxItems') || key.endsWith('.minItems'),
    );
    expect(arrayLimits).toEqual([]);
  });

  it('still names every field the Zod boundary requires', () => {
    expect(SUITE_SUMMARY_RESPONSE_JSON_SCHEMA.required).toEqual([
      'title',
      'description',
      'tags',
    ]);
  });
});
