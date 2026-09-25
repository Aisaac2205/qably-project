import { RESPONSE_JSON_SCHEMA } from './chat.assistant';

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

describe('RESPONSE_JSON_SCHEMA (chat)', () => {
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
      'title',
      'objective',
      'steps',
      'expectedResult',
      'priority',
    ]);
  });

  it('requires reply, cases and grounding at the top level', () => {
    expect(RESPONSE_JSON_SCHEMA.required).toEqual([
      'reply',
      'cases',
      'grounding',
    ]);
  });

  it('declares the grounding status as a bounded enum, not a free string', () => {
    expect(RESPONSE_JSON_SCHEMA.properties.grounding.properties.status).toEqual(
      { type: 'string', enum: ['grounded', 'insufficient'] },
    );
  });

  it('declares every grounding reference kind the server can validate', () => {
    expect(
      RESPONSE_JSON_SCHEMA.properties.grounding.properties.references.items
        .properties.kind,
    ).toEqual({
      type: 'string',
      enum: ['source-excerpt', 'code-change', 'review', 'attached-file'],
    });
  });

  it('carries no length or item-count bound on the nested grounding references array', () => {
    const referenceItems =
      RESPONSE_JSON_SCHEMA.properties.grounding.properties.references.items;
    expect(referenceItems.properties.id).toEqual({ type: 'string' });
    expect(
      RESPONSE_JSON_SCHEMA.properties.grounding.properties.references,
    ).not.toHaveProperty('maxItems');
    expect(
      RESPONSE_JSON_SCHEMA.properties.grounding.properties.references,
    ).not.toHaveProperty('minItems');
  });
});
