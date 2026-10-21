import type * as Ts from 'typescript';
import { loadTypescript } from './load-typescript';

export type TestRunner = 'vitest' | 'jest';

export type DetectedTestRunner = TestRunner | 'unknown';

/**
 * What decided the runner: an import of a test framework's module, a call on
 * a runner's API object (`vi.fn()`, `jest.mock()`), the caller's hint (the
 * runner the file's package is configured with), or nothing at all.
 */
export type RunnerEvidence = 'import' | 'api' | 'hint' | 'none';

export interface RunnerDetection {
  readonly runner: DetectedTestRunner;
  readonly evidence: RunnerEvidence;
}

type ImportedFramework = TestRunner | 'other';

const FRAMEWORK_BY_MODULE: ReadonlyMap<string, ImportedFramework> = new Map([
  ['vitest', 'vitest'],
  ['@jest/globals', 'jest'],
  ['@playwright/test', 'other'],
  ['node:test', 'other'],
  ['bun:test', 'other'],
  ['mocha', 'other'],
  ['ava', 'other'],
  ['uvu', 'other'],
  ['tap', 'other'],
]);

const RUNNER_BY_API_OBJECT: ReadonlyMap<string, TestRunner> = new Map([
  ['vi', 'vitest'],
  ['jest', 'jest'],
]);

function isRequireOrImportCall(expression: Ts.LeftHandSideExpression): boolean {
  const ts = loadTypescript();
  return (
    expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(expression) && expression.text === 'require')
  );
}

function importedModule(node: Ts.Node): string | undefined {
  const ts = loadTypescript();

  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }

  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    ts.isStringLiteral(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text;
  }

  if (ts.isCallExpression(node) && isRequireOrImportCall(node.expression)) {
    const [specifier] = node.arguments;
    if (specifier !== undefined && ts.isStringLiteralLike(specifier)) {
      return specifier.text;
    }
  }

  return undefined;
}

function apiObject(node: Ts.Node): string | undefined {
  const ts = loadTypescript();

  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    return node.expression.text;
  }

  if (ts.isQualifiedName(node) && ts.isIdentifier(node.left)) {
    return node.left.text;
  }

  return undefined;
}

function sole<T>(values: ReadonlySet<T>): T | undefined {
  return values.size === 1 ? [...values][0] : undefined;
}

function byImport(
  imported: ReadonlySet<ImportedFramework>,
): RunnerDetection | undefined {
  // A file that imports Playwright, node:test, mocha and the like is not a
  // vitest or jest file whatever its package runs: its keys follow other rules.
  if (imported.has('other')) return { runner: 'unknown', evidence: 'import' };

  const runner = sole(imported);
  return runner === undefined || runner === 'other'
    ? undefined
    : { runner, evidence: 'import' };
}

/**
 * Evidence in the file wins over the hint, and an import wins over an API
 * call. A level that points at both vitest and jest is no evidence at all, so
 * the decision moves on to the next level instead of picking one. An import of
 * any other test framework settles the answer as `unknown`.
 */
export function detectTestRunner(
  sourceFile: Ts.SourceFile,
  hint?: TestRunner,
): RunnerDetection {
  const ts = loadTypescript();
  const imported = new Set<ImportedFramework>();
  const called = new Set<TestRunner>();

  const visit = (node: Ts.Node): void => {
    const moduleName = importedModule(node);
    const framework =
      moduleName === undefined
        ? undefined
        : FRAMEWORK_BY_MODULE.get(moduleName);
    if (framework !== undefined) imported.add(framework);

    const objectName = apiObject(node);
    const calledRunner =
      objectName === undefined
        ? undefined
        : RUNNER_BY_API_OBJECT.get(objectName);
    if (calledRunner !== undefined) called.add(calledRunner);

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const fromImport = byImport(imported);
  if (fromImport !== undefined) return fromImport;

  const byApi = sole(called);
  if (byApi !== undefined) return { runner: byApi, evidence: 'api' };

  if (hint !== undefined) return { runner: hint, evidence: 'hint' };

  return { runner: 'unknown', evidence: 'none' };
}
