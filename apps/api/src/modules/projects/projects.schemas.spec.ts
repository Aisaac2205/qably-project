import { createProjectSchema, updateProjectSchema } from './projects.schemas';

describe('createProjectSchema', () => {
  it('trims the name and defaults technologies to an empty list', () => {
    const parsed = createProjectSchema.parse({ name: '  Checkout  ' });

    expect(parsed).toEqual({ name: 'Checkout', technologies: [] });
  });

  it('rejects a name that is only whitespace', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('accepts a repository in owner/name form', () => {
    expect(
      createProjectSchema.parse({ name: 'Checkout', githubRepo: 'acme/shop' })
        .githubRepo,
    ).toBe('acme/shop');
  });

  it('rejects a repository given as a full url', () => {
    expect(
      createProjectSchema.safeParse({
        name: 'Checkout',
        githubRepo: 'https://github.com/acme/shop',
      }).success,
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
