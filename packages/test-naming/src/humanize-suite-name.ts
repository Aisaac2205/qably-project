import { isDottedIdentifier, isIdentifier, isPascalIdentifier, isPathLike, lastDottedSegment } from './conventions';
import { clampGraphemes, MAX_SUITE_NAME_LENGTH, sanitize } from './sanitize';

const FILE_SUFFIXES: readonly string[] = [
  '.e2e-spec.tsx',
  '.e2e-spec.ts',
  '.test.tsx',
  '.test.ts',
  '.test.jsx',
  '.test.js',
  '.test.mjs',
  '.test.cjs',
  '.spec.tsx',
  '.spec.ts',
  '.spec.jsx',
  '.spec.js',
  '.spec.mjs',
  '.spec.cjs',
  '.py',
  '.java',
  '.kt',
  '.scala',
  '.rb',
  '.go',
  '.cs',
  '.php',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
];

const PYTHON_PREFIX = 'test_';
const PYTHON_SUFFIX = '_test';
const CLASS_SUFFIXES: readonly string[] = ['Tests', 'Test'];

function basename(path: string): string {
  const normalized = path.replace(/\\/gu, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function stripFileSuffix(fileName: string): string {
  for (const suffix of FILE_SUFFIXES) {
    if (fileName.endsWith(suffix)) {
      return fileName.slice(0, -suffix.length);
    }
  }
  return fileName;
}

function stripPythonMarkers(stem: string): string {
  if (stem.startsWith(PYTHON_PREFIX) && stem.length > PYTHON_PREFIX.length) {
    return stem.slice(PYTHON_PREFIX.length);
  }
  if (stem.endsWith(PYTHON_SUFFIX) && stem.length > PYTHON_SUFFIX.length) {
    return stem.slice(0, -PYTHON_SUFFIX.length);
  }
  return stem;
}

function stripClassSuffix(identifier: string): string {
  for (const suffix of CLASS_SUFFIXES) {
    if (identifier.endsWith(suffix) && identifier.length > suffix.length) {
      return identifier.slice(0, -suffix.length);
    }
  }
  return identifier;
}

export function humanizeSuiteName(name: string): string {
  const sanitized = sanitize(name);
  if (sanitized.length === 0) {
    return '';
  }

  let stem = sanitized;
  if (isPathLike(sanitized)) {
    stem = stripPythonMarkers(stripFileSuffix(basename(sanitized)));
  } else if (isDottedIdentifier(sanitized) && isPascalIdentifier(lastDottedSegment(sanitized))) {
    stem = stripClassSuffix(lastDottedSegment(sanitized));
  } else if (isIdentifier(sanitized)) {
    stem = stripClassSuffix(sanitized);
  }

  const result = stem.length === 0 ? sanitized : stem;
  return clampGraphemes(result, MAX_SUITE_NAME_LENGTH);
}
