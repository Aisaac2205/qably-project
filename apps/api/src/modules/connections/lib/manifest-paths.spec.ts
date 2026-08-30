import { MAX_MANIFESTS, selectManifestPaths } from './manifest-paths';

function tree(...paths: string[]) {
  return paths.map((path) => ({ path, type: 'blob' }));
}

describe('selectManifestPaths', () => {
  it('finds the manifest of a single package repository', () => {
    expect(selectManifestPaths(tree('package.json', 'README.md'))).toEqual([
      'package.json',
    ]);
  });

  it('finds the manifest of every workspace in a monorepo', () => {
    const selected = selectManifestPaths(
      tree(
        'package.json',
        'apps/api/package.json',
        'apps/web/package.json',
        'packages/types/package.json',
      ),
    );

    expect(selected).toEqual([
      'package.json',
      'apps/api/package.json',
      'apps/web/package.json',
      'packages/types/package.json',
    ]);
  });

  it('mixes languages inside one monorepo', () => {
    const selected = selectManifestPaths(
      tree('services/api/pom.xml', 'apps/site/package.json'),
    );

    expect(selected).toEqual(
      expect.arrayContaining([
        'services/api/pom.xml',
        'apps/site/package.json',
      ]),
    );
  });

  it('never reads a dependency directory', () => {
    expect(
      selectManifestPaths(
        tree('node_modules/react/package.json', 'vendor/laravel/composer.json'),
      ),
    ).toEqual([]);
  });

  it('never reads build output', () => {
    expect(
      selectManifestPaths(
        tree('dist/package.json', 'apps/web/.next/package.json'),
      ),
    ).toEqual([]);
  });

  it('ignores a manifest buried too deep to be a workspace root', () => {
    expect(selectManifestPaths(tree('a/b/c/d/package.json'))).toEqual([]);
  });

  it('ignores directories that merely share a manifest name', () => {
    expect(
      selectManifestPaths([{ path: 'package.json', type: 'tree' }]),
    ).toEqual([]);
  });

  it('puts the shallowest manifests first so the root wins ties', () => {
    const selected = selectManifestPaths(
      tree('apps/api/package.json', 'package.json'),
    );

    expect(selected[0]).toBe('package.json');
  });

  it('caps how many files it will fetch from one repository', () => {
    const many = Array.from(
      { length: MAX_MANIFESTS + 5 },
      (_, index) => `packages/p${index}/package.json`,
    );

    expect(selectManifestPaths(tree(...many))).toHaveLength(MAX_MANIFESTS);
  });

  it('returns nothing when github does not answer with a tree', () => {
    expect(selectManifestPaths(null)).toEqual([]);
    expect(selectManifestPaths({ message: 'Not Found' })).toEqual([]);
  });
});
