import {
  createCaseSchema,
  createSuiteSchema,
  updateCaseSchema,
  updateSuiteSchema,
} from './suites.schemas';

describe('createSuiteSchema', () => {
  it('fills the optional fields the ui does not send', () => {
    expect(
      createSuiteSchema.parse({ projectId: 'project-1', name: '  Checkout  ' }),
    ).toEqual({
      projectId: 'project-1',
      name: 'Checkout',
      description: '',
      tags: [],
      isDefault: false,
    });
  });

  it('requires a project so a suite can never be orphaned', () => {
    expect(createSuiteSchema.safeParse({ name: 'Checkout' }).success).toBe(
      false,
    );
  });
});

describe('updateSuiteSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateSuiteSchema.safeParse({}).success).toBe(false);
  });

  it('accepts promoting a suite to default on its own', () => {
    expect(updateSuiteSchema.parse({ isDefault: true })).toEqual({
      isDefault: true,
    });
  });
});

describe('createCaseSchema', () => {
  it('defaults priority and state to the values the ui shows', () => {
    const parsed = createCaseSchema.parse({ name: 'Adds to cart' });

    expect(parsed.priority).toBe('medium');
    expect(parsed.state).toBe('active');
    expect(parsed.steps).toEqual([]);
  });

  it('rejects a step that is only whitespace', () => {
    expect(
      createCaseSchema.safeParse({ name: 'Adds to cart', steps: ['  '] })
        .success,
    ).toBe(false);
  });

  it('rejects an unknown priority', () => {
    expect(
      createCaseSchema.safeParse({ name: 'Adds to cart', priority: 'urgent' })
        .success,
    ).toBe(false);
  });
});

describe('updateCaseSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateCaseSchema.safeParse({}).success).toBe(false);
  });
});
