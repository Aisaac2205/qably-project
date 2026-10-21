import * as ts from 'typescript';

export type TestRunner = 'vitest' | 'jest';

export type DetectedTestRunner = TestRunner | 'unknown';

/**
 * What decided the runner: an import of the runner's module, a call on its
 * API object (`vi.fn()`, `jest.mock()`), the caller's hint (the runner the
 * file's package is configured with), or nothing at all.
 */
export type RunnerEvidence = 'import' | 'api' | 'hint' | 'none';

export interface RunnerDetection {
  readonly runner: DetectedTestRunner;
  readonly evidence: RunnerEvidence;
}

const RUNNER_BY_MODULE: ReadonlyMap<string, TestRunner> = new Map([
  ['vitest', 'vitest'],
  ['@jest/globals', 'jest'],
]);

const RUNNER_BY_API_OBJECT: ReadonlyMap<string, TestRunner> = new Map([
  ['vi', 'vitest'],
  ['jest', 'jest'],
]);

function isRequireOrImportCall(expression: ts.LeftHandSideExpression): boolean {
  return (
    expression.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(expression) && expression.text === 'require')
  );
}

function importedModule(node: ts.Node): string | undefined {
  if (
    ts.isImportDeclaration(node) &&
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

function apiObject(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    return node.expression.text;
  }

  if (ts.isQualifiedName(node) && ts.isIdentifier(node.left)) {
    return node.left.text;
  }

  return undefined;
}

function sole(runners: ReadonlySet<TestRunner>): TestRunner | undefined {
  return runners.size === 1 ? [...runners][0] : undefined;
}

/**
 * Evidence in the file wins over the hint, and an import wins over an API
 * call. A level that points at both runners is no evidence at all, so the
 * decision moves on to the next level instead of picking one.
 */
export function detectTestRunner(
  sourceFile: ts.SourceFile,
  hint?: TestRunner,
): RunnerDetection {
  const imported = new Set<TestRunner>();
  const called = new Set<TestRunner>();

  const visit = (node: ts.Node): void => {
    const moduleName = importedModule(node);
    const importedRunner =
      moduleName === undefined ? undefined : RUNNER_BY_MODULE.get(moduleName);
    if (importedRunner !== undefined) imported.add(importedRunner);

    const objectName = apiObject(node);
    const calledRunner =
      objectName === undefined
        ? undefined
        : RUNNER_BY_API_OBJECT.get(objectName);
    if (calledRunner !== undefined) called.add(calledRunner);

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const byImport = sole(imported);
  if (byImport !== undefined) return { runner: byImport, evidence: 'import' };

  const byApi = sole(called);
  if (byApi !== undefined) return { runner: byApi, evidence: 'api' };

  if (hint !== undefined) return { runner: hint, evidence: 'hint' };

  return { runner: 'unknown', evidence: 'none' };
}
