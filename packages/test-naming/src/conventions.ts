export type Convention =
  | 'vitest'
  | 'playwright'
  | 'pytest'
  | 'junit-java'
  | 'gtest'
  | 'jest-junit'
  | 'unknown';

export interface TestNameInput {
  readonly name: string;
  readonly className?: string;
  readonly filePath?: string;
}

export interface HumanizedTest {
  readonly title: string;
  readonly path: readonly string[];
  readonly raw: string;
  readonly convention: Convention;
  readonly parameter?: string;
}

const VITEST_SEPARATOR = ' > ';
const PLAYWRIGHT_SEPARATOR = ' › ';
const PYTEST_SEPARATOR = '::';

const TEST_FILE_EXTENSION = /\.(test|spec|e2e-spec)\.[cm]?[jt]sx?$/u;
const SOURCE_FILE_EXTENSION = /\.(py|java|kt|scala|rb|go|cs|php|[cm]?[jt]sx?)$/u;
const IDENTIFIER = /^[\p{L}\p{N}_$]+$/u;
const PASCAL_IDENTIFIER = /^\p{Lu}[\p{L}\p{N}_]*$/u;
const DOTTED_IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*(\.[\p{L}_$][\p{L}\p{N}_$]*)+$/u;
const PYTHON_TEST_FUNCTION = /^test_/u;
const JUNIT5_INDEXED_DISPLAY_NAME = /^\[\d+\] \S/u;

export interface CallSuffixSplit {
  readonly base: string;
  readonly args?: string;
}

export function splitCallSuffix(name: string): CallSuffixSplit {
  if (!name.endsWith(')')) {
    return { base: name };
  }
  const open = name.lastIndexOf('(');
  if (open <= 0) {
    return { base: name };
  }
  const base = name.slice(0, open).trim();
  if (!IDENTIFIER.test(base)) {
    return { base: name };
  }
  const args = name.slice(open + 1, -1).trim();
  return args.length === 0 ? { base } : { base, args };
}

export function isJunit5IndexedDisplayName(name: string): boolean {
  return JUNIT5_INDEXED_DISPLAY_NAME.test(name);
}

export const separators = {
  vitest: VITEST_SEPARATOR,
  playwright: PLAYWRIGHT_SEPARATOR,
  pytest: PYTEST_SEPARATOR,
} as const;

export function isPathLike(value: string): boolean {
  return value.includes('/') || value.includes('\\') || TEST_FILE_EXTENSION.test(value) || SOURCE_FILE_EXTENSION.test(value);
}

export function isIdentifier(value: string): boolean {
  return IDENTIFIER.test(value);
}

export function isPascalIdentifier(value: string): boolean {
  return PASCAL_IDENTIFIER.test(value);
}

export function isDottedIdentifier(value: string): boolean {
  return DOTTED_IDENTIFIER.test(value);
}

export function lastDottedSegment(value: string): string {
  const index = value.lastIndexOf('.');
  return index === -1 ? value : value.slice(index + 1);
}

function isPytestClassName(className: string, name: string): boolean {
  if (!isDottedIdentifier(className)) {
    return false;
  }
  if (PYTHON_TEST_FUNCTION.test(name)) {
    return true;
  }
  const hasSnakeSegment = className.split('.').some((segment) => segment.includes('_'));
  return hasSnakeSegment && name.includes('_');
}

function isJavaClassName(className: string): boolean {
  if (!isDottedIdentifier(className)) {
    return false;
  }
  return isPascalIdentifier(lastDottedSegment(className));
}

function isGtestPair(name: string): boolean {
  const parts = name.split('.');
  if (parts.length !== 2) {
    return false;
  }
  const [suite, testCase] = parts;
  return suite !== undefined && testCase !== undefined && isIdentifier(suite) && isPascalIdentifier(testCase);
}

export function detectConvention(name: string, className: string | undefined, filePath: string | undefined): Convention {
  if (name.includes(VITEST_SEPARATOR)) {
    return 'vitest';
  }
  if (name.includes(PLAYWRIGHT_SEPARATOR)) {
    return 'playwright';
  }
  if (name.includes(PYTEST_SEPARATOR) || (filePath !== undefined && filePath.endsWith('.py'))) {
    return 'pytest';
  }
  if (className !== undefined && isPytestClassName(className, name)) {
    return 'pytest';
  }
  if (
    className !== undefined &&
    isJavaClassName(className) &&
    (isIdentifier(splitCallSuffix(name).base) || isJunit5IndexedDisplayName(name))
  ) {
    return 'junit-java';
  }
  if (isGtestPair(name)) {
    return 'gtest';
  }
  if (className !== undefined && isPascalIdentifier(className) && isPascalIdentifier(name)) {
    return 'gtest';
  }
  if (className !== undefined && isPathLike(className)) {
    return 'vitest';
  }
  if (className !== undefined && name.includes(' ') && (className === name || name.startsWith(`${className} `))) {
    return 'jest-junit';
  }
  return 'unknown';
}
