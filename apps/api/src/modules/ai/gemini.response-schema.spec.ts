import { RESPONSE_JSON_SCHEMA } from './gemini.extractor';

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

describe('RESPONSE_JSON_SCHEMA', () => {
  const keys = collectKeys(RESPONSE_JSON_SCHEMA);

  it('carries no string length limits, which the provider rejects as too many states', () => {
    expect(keys.some((key) => key.endsWith('.maxLength'))).toBe(false);
    expect(keys.some((key) => key.endsWith('.minLength'))).toBe(false);
  });

  it('limits array length only at the top level, never on a nested array', () => {
    const arrayLimits = keys.filter(
      (key) => key.endsWith('.maxItems') || key.endsWith('.minItems'),
    );
    expect(arrayLimits).toEqual(['properties.cases.maxItems']);
  });

  it('still names every field the Zod boundary requires', () => {
    expect(RESPONSE_JSON_SCHEMA.properties.cases.items.required).toEqual([
      'automationKey',
      'title',
      'objective',
      'steps',
      'expectedResult',
      'priority',
      'sourceExcerpt',
    ]);
  });
});
