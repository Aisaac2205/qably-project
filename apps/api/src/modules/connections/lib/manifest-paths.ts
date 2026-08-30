import { MANIFEST_PATHS, type ManifestPath } from './detect-stack';

export const MAX_MANIFESTS = 12;

const MAX_DEPTH = 3;

const IGNORED_SEGMENTS = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  '.venv',
  'fixtures',
  '__fixtures__',
]);

interface TreeEntry {
  path?: unknown;
  type?: unknown;
}

const MANIFEST_NAMES = new Set<string>(MANIFEST_PATHS);

function isManifest(path: string): boolean {
  const segments = path.split('/');
  const name = segments[segments.length - 1];

  if (!MANIFEST_NAMES.has(name)) return false;
  if (segments.length > MAX_DEPTH + 1) return false;

  return !segments
    .slice(0, -1)
    .some((segment) => IGNORED_SEGMENTS.has(segment));
}

export function manifestKind(path: string): ManifestPath {
  return path.split('/').pop() as ManifestPath;
}

export function selectManifestPaths(payload: unknown): string[] {
  const entries = Array.isArray(payload)
    ? payload
    : ((payload as { tree?: unknown } | null)?.tree ?? null);

  if (!Array.isArray(entries)) return [];

  return (entries as TreeEntry[])
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter((path): path is string => typeof path === 'string')
    .filter(isManifest)
    .sort((a, b) => a.split('/').length - b.split('/').length)
    .slice(0, MAX_MANIFESTS);
}
