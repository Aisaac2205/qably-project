import { createProjectSchema, updateProjectSchema } from './projects.schemas';

describe('createProjectSchema', () => {
  it('trims the name and defaults technologies to an empty list', () => {
    const parsed = createProjectSchema.parse({ name: '  Checkout  ' });

    expect(parsed).toEqual({ name: 'Checkout', technologies: [] });
  });

  it('rejects a name that is only whitespace', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('accepts the identifier of an existing repository connection', () => {
    expect(
      createProjectSchema.parse({ name: 'Checkout', connectionId: 'conn-1' })
        .connectionId,
    ).toBe('conn-1');
  });

  it('rejects a repository typed by hand instead of a connection', () => {
    expect(
      createProjectSchema.safeParse({ name: 'Checkout', connectionId: '   ' })
        .success,
    ).toBe(false);
  });
});

describe('updateProjectSchema', () => {
  it('allows clearing an optional field with null', () => {
    expect(updateProjectSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });

  it('rejects an empty patch', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateProjectSchema testFilePatterns', () => {
  it('accepts the globs of the frameworks the extractor knows', () => {
    const parsed = updateProjectSchema.parse({
      testFilePatterns: ['**/*.test.tsx', 'test_*.py', '*Test.java'],
    });

    expect(parsed.testFilePatterns).toEqual([
      '**/*.test.tsx',
      'test_*.py',
      '*Test.java',
    ]);
  });

  it('rejects a pattern made only of wildcards, which would match every file', () => {
    for (const pattern of ['**', '*', '**/*', '?']) {
      expect(
        updateProjectSchema.safeParse({ testFilePatterns: [pattern] }).success,
      ).toBe(false);
    }
  });

  it('rejects an empty list, so a project always declares what a test is', () => {
    expect(
      updateProjectSchema.safeParse({ testFilePatterns: [] }).success,
    ).toBe(false);
  });

  it('rejects a blank pattern', () => {
    expect(
      updateProjectSchema.safeParse({ testFilePatterns: ['   '] }).success,
    ).toBe(false);
  });
});
