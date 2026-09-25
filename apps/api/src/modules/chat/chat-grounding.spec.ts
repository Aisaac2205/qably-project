import {
  buildGroundingManifest,
  groundingDeclarationSchema,
  resolveGrounding,
  MAX_GROUNDING_REFERENCES,
  type GroundingDeclaration,
} from './chat-grounding';

describe('buildGroundingManifest', () => {
  it('lists every attached case id as a source-excerpt reference', () => {
    expect(buildGroundingManifest(['case-1', 'case-2'], false)).toEqual([
      { kind: 'source-excerpt', id: 'case-1' },
      { kind: 'source-excerpt', id: 'case-2' },
    ]);
  });

  it('adds the fixed F1 attached-file reference when a file was sent this turn', () => {
    expect(buildGroundingManifest([], true)).toEqual([
      { kind: 'attached-file', id: 'F1' },
    ]);
  });

  it('is empty when neither a case nor a file was attached', () => {
    expect(buildGroundingManifest([], false)).toEqual([]);
  });

  it('combines attached cases and an attached file in the same turn', () => {
    expect(buildGroundingManifest(['case-1'], true)).toEqual([
      { kind: 'source-excerpt', id: 'case-1' },
      { kind: 'attached-file', id: 'F1' },
    ]);
  });
});

describe('resolveGrounding', () => {
  const manifest = [
    { kind: 'source-excerpt' as const, id: 'case-1' },
    { kind: 'attached-file' as const, id: 'F1' },
  ];

  it('passes an insufficient declaration through untouched, no manifest check', () => {
    const result = resolveGrounding({ status: 'insufficient' }, []);

    expect(result).toEqual({
      outcome: 'insufficient',
      view: { status: 'insufficient' },
    });
  });

  it('accepts a grounded declaration whose references are all sent this turn', () => {
    const declaration: GroundingDeclaration = {
      status: 'grounded',
      references: [{ kind: 'source-excerpt', id: 'case-1' }],
    };

    expect(resolveGrounding(declaration, manifest)).toEqual({
      outcome: 'grounded',
      view: {
        status: 'grounded',
        references: [{ kind: 'source-excerpt', id: 'case-1' }],
      },
    });
  });

  it('accepts a grounded declaration with zero references, since project data has no per-item ids to cite', () => {
    const declaration: GroundingDeclaration = {
      status: 'grounded',
      references: [],
    };

    expect(resolveGrounding(declaration, [])).toEqual({
      outcome: 'grounded',
      view: { status: 'grounded', references: [] },
    });
  });

  it('downgrades a grounded declaration citing an id absent from the manifest', () => {
    const declaration: GroundingDeclaration = {
      status: 'grounded',
      references: [{ kind: 'source-excerpt', id: 'case-ghost' }],
    };

    expect(resolveGrounding(declaration, manifest)).toEqual({
      outcome: 'fabricated',
      view: { status: 'insufficient' },
    });
  });

  it('downgrades a grounded declaration citing a real id under the wrong kind', () => {
    const declaration: GroundingDeclaration = {
      status: 'grounded',
      references: [{ kind: 'attached-file', id: 'case-1' }],
    };

    expect(resolveGrounding(declaration, manifest).outcome).toBe('fabricated');
  });

  it('downgrades as soon as one of several references is unknown, even when the rest are valid', () => {
    const declaration: GroundingDeclaration = {
      status: 'grounded',
      references: [
        { kind: 'source-excerpt', id: 'case-1' },
        { kind: 'attached-file', id: 'F1' },
        { kind: 'source-excerpt', id: 'case-ghost' },
      ],
    };

    expect(resolveGrounding(declaration, manifest).outcome).toBe('fabricated');
  });
});

describe('groundingDeclarationSchema', () => {
  it('accepts an insufficient declaration with no references field', () => {
    expect(
      groundingDeclarationSchema.safeParse({ status: 'insufficient' }).success,
    ).toBe(true);
  });

  it('accepts a grounded declaration with a bounded references array', () => {
    expect(
      groundingDeclarationSchema.safeParse({
        status: 'grounded',
        references: [{ kind: 'source-excerpt', id: 'case-1' }],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown reference kind', () => {
    expect(
      groundingDeclarationSchema.safeParse({
        status: 'grounded',
        references: [{ kind: 'made-up-kind', id: 'case-1' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty reference id', () => {
    expect(
      groundingDeclarationSchema.safeParse({
        status: 'grounded',
        references: [{ kind: 'source-excerpt', id: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects more references than the bound allows', () => {
    const references = Array.from(
      { length: MAX_GROUNDING_REFERENCES + 1 },
      (_, index) => ({
        kind: 'source-excerpt' as const,
        id: `case-${index}`,
      }),
    );

    expect(
      groundingDeclarationSchema.safeParse({
        status: 'grounded',
        references,
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(
      groundingDeclarationSchema.safeParse({ status: 'maybe' }).success,
    ).toBe(false);
  });

  it('rejects a grounded declaration with no references field at all', () => {
    expect(
      groundingDeclarationSchema.safeParse({ status: 'grounded' }).success,
    ).toBe(false);
  });
});
