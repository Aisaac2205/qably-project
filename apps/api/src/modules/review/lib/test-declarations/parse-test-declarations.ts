import type * as Ts from 'typescript';
import { hashDeclarationText, hashSourceGroups } from './body-hash';
import {
  detectTestRunner,
  type RunnerDetection,
  type TestRunner,
} from './detect-test-runner';
import { loadTypescript } from './load-typescript';

export type DeclarationKind = 'it' | 'test';

export type TestModifier =
  | 'each'
  | 'for'
  | 'only'
  | 'skip'
  | 'todo'
  | 'concurrent'
  | 'sequential'
  | 'shuffle'
  | 'failing'
  | 'fails'
  | 'skipIf'
  | 'runIf';

export interface TestDeclaration {
  readonly kind: DeclarationKind;
  /** The title as written, or its raw source text when `dynamicTitle`. */
  readonly title: string;
  /** The title is not a string literal or a template without substitutions. */
  readonly dynamicTitle: boolean;
  /** Enclosing describe/context/suite titles, outermost first. */
  readonly describePath: readonly string[];
  /** At least one entry of `describePath` is raw source text, not a title. */
  readonly dynamicDescribePath: boolean;
  /** Modifiers chained on the declaration itself, in source order. */
  readonly modifiers: readonly TestModifier[];
  /**
   * The declaration, or a describe around it, runs once per table row
   * (`.each`/`.for`): the reporter emits one rendered title per row, and
   * `title`/`describePath` hold the template.
   */
  readonly parametrized: boolean;
  /** 1-based lines of the whole call expression, table included. */
  readonly startLine: number;
  readonly endLine: number;
  /** sha256 of the call expression's text (see `hashDeclarationText`). */
  readonly bodyHash: string;
  /**
   * sha256 of what the declaration runs under inside its describes: for each
   * enclosing describe, outermost first, its `.each` table or other factory
   * arguments and every statement directly in its body that is not a nested
   * describe or test (hooks, helpers, fixtures, constants), then the
   * declaration's own factory arguments.
   */
  readonly contextHash: string;
}

export interface ParseTestDeclarationsInput {
  /** Used for its extension, which selects the grammar. */
  readonly filePath: string;
  readonly content: string;
  /** The runner of the file's package, used when the file names none. */
  readonly runnerHint?: TestRunner;
  /** Longest content read, in UTF-16 code units. */
  readonly maxContentLength?: number;
}

export type ParseTestDeclarationsResult =
  | {
      readonly kind: 'parsed';
      readonly runner: RunnerDetection;
      readonly declarations: readonly TestDeclaration[];
      /**
       * sha256 of the file's top-level statements that are neither imports
       * nor describe/test calls: top-level hooks, helpers, fixtures, mocks
       * and constants every declaration may depend on.
       */
      readonly fileContextHash: string;
    }
  | {
      readonly kind: 'unsupported';
      readonly reason: 'unsupported-extension' | 'too-large';
    }
  | {
      readonly kind: 'error';
      readonly reason: 'syntax-error' | 'parser-failure';
      readonly message: string;
    };

export const DEFAULT_MAX_CONTENT_LENGTH = 1_000_000;

type ScriptKindName = 'TS' | 'TSX' | 'JS' | 'JSX';

const SCRIPT_KIND_BY_EXTENSION: ReadonlyMap<string, ScriptKindName> = new Map([
  ['.ts', 'TS'],
  ['.mts', 'TS'],
  ['.cts', 'TS'],
  ['.tsx', 'TSX'],
  ['.js', 'JS'],
  ['.mjs', 'JS'],
  ['.cjs', 'JS'],
  ['.jsx', 'JSX'],
]);

interface BaseCallee<K> {
  readonly kind: K;
  readonly modifiers: readonly TestModifier[];
}

const TEST_BASES: ReadonlyMap<string, BaseCallee<DeclarationKind>> = new Map([
  ['it', { kind: 'it', modifiers: [] }],
  ['test', { kind: 'test', modifiers: [] }],
  ['xit', { kind: 'it', modifiers: ['skip'] }],
  ['xtest', { kind: 'test', modifiers: ['skip'] }],
  ['fit', { kind: 'it', modifiers: ['only'] }],
]);

const DESCRIBE_BASES: ReadonlyMap<string, readonly TestModifier[]> = new Map([
  ['describe', []],
  ['context', []],
  ['suite', []],
  ['xdescribe', ['skip']],
  ['fdescribe', ['only']],
]);

const HOOKS: ReadonlySet<string> = new Set([
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
]);

const PLAIN_MODIFIERS: ReadonlySet<string> = new Set<TestModifier>([
  'only',
  'skip',
  'todo',
  'concurrent',
  'sequential',
  'shuffle',
  'failing',
  'fails',
]);

/** Modifiers that return the test function only once they are invoked. */
const FACTORY_MODIFIERS: ReadonlySet<string> = new Set<TestModifier>([
  'each',
  'for',
  'skipIf',
  'runIf',
]);

const TABLE_MODIFIERS: ReadonlySet<TestModifier> = new Set(['each', 'for']);

interface CalleeChain {
  readonly base: string;
  readonly modifiers: readonly TestModifier[];
  /** Still a factory such as `it.each([...])`'s `it.each`, not a test function. */
  readonly awaitingInvocation: boolean;
  /** What the factories were invoked with: `.each` tables, `skipIf` conditions. */
  readonly factoryArguments: readonly Ts.Node[];
}

function readCallee(expression: Ts.Expression): CalleeChain | undefined {
  const ts = loadTypescript();

  if (ts.isIdentifier(expression)) {
    return {
      base: expression.text,
      modifiers: [],
      awaitingInvocation: false,
      factoryArguments: [],
    };
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const inner = readCallee(expression.expression);
    if (inner === undefined || inner.awaitingInvocation) return undefined;

    const name = expression.name.text;
    if (!PLAIN_MODIFIERS.has(name) && !FACTORY_MODIFIERS.has(name)) {
      return undefined;
    }

    return {
      ...inner,
      modifiers: [...inner.modifiers, name as TestModifier],
      awaitingInvocation: FACTORY_MODIFIERS.has(name),
    };
  }

  if (ts.isCallExpression(expression)) {
    const inner = readCallee(expression.expression);
    if (inner === undefined || !inner.awaitingInvocation) return undefined;

    return {
      ...inner,
      awaitingInvocation: false,
      factoryArguments: [...inner.factoryArguments, ...expression.arguments],
    };
  }

  if (ts.isTaggedTemplateExpression(expression)) {
    const inner = readCallee(expression.tag);
    if (inner === undefined || !inner.awaitingInvocation) return undefined;

    return {
      ...inner,
      awaitingInvocation: false,
      factoryArguments: [...inner.factoryArguments, expression.template],
    };
  }

  return undefined;
}

/**
 * A function, or an expression that can evaluate to one (`handler`,
 * `fakeAsync(() => ...)`). A literal cannot, which is what tells Playwright's
 * `test.skip(condition, 'reason')` apart from a declaration.
 */
function isTestFunction(node: Ts.Node | undefined): boolean {
  const ts = loadTypescript();
  return (
    node !== undefined &&
    (ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isCallExpression(node))
  );
}

function hasTestFunction(call: Ts.CallExpression): boolean {
  const ts = loadTypescript();
  const [, second, third] = call.arguments;

  return (
    isTestFunction(second) ||
    (second !== undefined &&
      ts.isObjectLiteralExpression(second) &&
      isTestFunction(third))
  );
}

type CallRole =
  | {
      readonly role: 'test';
      readonly kind: DeclarationKind;
      readonly modifiers: readonly TestModifier[];
      readonly factoryArguments: readonly Ts.Node[];
    }
  | {
      readonly role: 'describe';
      readonly modifiers: readonly TestModifier[];
      readonly factoryArguments: readonly Ts.Node[];
    };

function classifyCall(call: Ts.CallExpression): CallRole | undefined {
  if (call.arguments.length === 0) return undefined;

  const callee = readCallee(call.expression);
  if (callee === undefined || callee.awaitingInvocation) return undefined;

  const test = TEST_BASES.get(callee.base);
  if (test !== undefined) {
    const modifiers = [...test.modifiers, ...callee.modifiers];
    if (!modifiers.includes('todo') && !hasTestFunction(call)) return undefined;

    return {
      role: 'test',
      kind: test.kind,
      modifiers,
      factoryArguments: callee.factoryArguments,
    };
  }

  const describe = DESCRIBE_BASES.get(callee.base);
  if (describe !== undefined) {
    return {
      role: 'describe',
      modifiers: [...describe, ...callee.modifiers],
      factoryArguments: callee.factoryArguments,
    };
  }

  return undefined;
}

function isHookCall(call: Ts.CallExpression): boolean {
  const ts = loadTypescript();
  return ts.isIdentifier(call.expression) && HOOKS.has(call.expression.text);
}

function isDeclarationStatement(statement: Ts.Statement): boolean {
  const ts = loadTypescript();
  return (
    ts.isExpressionStatement(statement) &&
    ts.isCallExpression(statement.expression) &&
    classifyCall(statement.expression) !== undefined
  );
}

interface Title {
  readonly text: string;
  readonly dynamic: boolean;
}

function readTitle(node: Ts.Expression, sourceFile: Ts.SourceFile): Title {
  const ts = loadTypescript();

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, dynamic: false };
  }

  return { text: node.getText(sourceFile), dynamic: true };
}

/**
 * The statements a describe body runs besides its nested describes and tests.
 * A body that is not a function literal (`describe('x', sharedSuite)`) counts
 * as its own source text.
 */
function describeBodyContext(
  argument: Ts.Expression,
  sourceFile: Ts.SourceFile,
): string[] {
  const ts = loadTypescript();

  if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) {
    return [argument.getText(sourceFile)];
  }

  const { body } = argument;
  if (ts.isBlock(body)) {
    return body.statements
      .filter((statement) => !isDeclarationStatement(statement))
      .map((statement) => statement.getText(sourceFile));
  }

  const isDeclaration =
    ts.isCallExpression(body) && classifyCall(body) !== undefined;
  return isDeclaration ? [] : [body.getText(sourceFile)];
}

interface DescribeScope {
  readonly title: Title;
  readonly parametrized: boolean;
  /** Factory arguments first, then the body statements. */
  readonly context: readonly string[];
}

function isParametrized(modifiers: readonly TestModifier[]): boolean {
  return modifiers.some((modifier) => TABLE_MODIFIERS.has(modifier));
}

function lineOf(sourceFile: Ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function textsOf(
  nodes: readonly Ts.Node[],
  sourceFile: Ts.SourceFile,
): string[] {
  return nodes.map((node) => node.getText(sourceFile));
}

function toDeclaration(
  call: Ts.CallExpression,
  role: Extract<CallRole, { role: 'test' }>,
  scopes: readonly DescribeScope[],
  sourceFile: Ts.SourceFile,
): TestDeclaration {
  const title = readTitle(call.arguments[0], sourceFile);

  return {
    kind: role.kind,
    title: title.text,
    dynamicTitle: title.dynamic,
    describePath: scopes.map((scope) => scope.title.text),
    dynamicDescribePath: scopes.some((scope) => scope.title.dynamic),
    modifiers: role.modifiers,
    parametrized:
      isParametrized(role.modifiers) ||
      scopes.some((scope) => scope.parametrized),
    startLine: lineOf(sourceFile, call.getStart(sourceFile)),
    endLine: lineOf(sourceFile, call.getEnd()),
    bodyHash: hashDeclarationText(call.getText(sourceFile)),
    contextHash: hashSourceGroups([
      ...scopes.map((scope) => scope.context),
      textsOf(role.factoryArguments, sourceFile),
    ]),
  };
}

/**
 * Walks the whole file, not only top-level statements, so a declaration
 * nested in any expression is found with the describe scopes it is written
 * in. Test bodies and hooks are not searched: runners reject a declaration
 * inside either.
 */
function collectDeclarations(sourceFile: Ts.SourceFile): TestDeclaration[] {
  const ts = loadTypescript();
  const declarations: TestDeclaration[] = [];

  const visit = (node: Ts.Node, scopes: readonly DescribeScope[]): void => {
    if (ts.isCallExpression(node)) {
      if (isHookCall(node)) return;

      const role = classifyCall(node);

      if (role?.role === 'test') {
        declarations.push(toDeclaration(node, role, scopes, sourceFile));
        return;
      }

      if (role?.role === 'describe') {
        const [title, ...body] = node.arguments;
        const inner = [
          ...scopes,
          {
            title: readTitle(title, sourceFile),
            parametrized: isParametrized(role.modifiers),
            context: [
              ...textsOf(role.factoryArguments, sourceFile),
              ...body.flatMap((argument) =>
                describeBodyContext(argument, sourceFile),
              ),
            ],
          },
        ];
        for (const argument of body) visit(argument, inner);
        return;
      }
    }

    ts.forEachChild(node, (child) => visit(child, scopes));
  };

  visit(sourceFile, []);

  return declarations;
}

function isRequireCall(node: Ts.Expression): boolean {
  const ts = loadTypescript();
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require'
  );
}

function isImportStatement(statement: Ts.Statement): boolean {
  const ts = loadTypescript();

  if (ts.isImportDeclaration(statement)) return true;
  if (ts.isImportEqualsDeclaration(statement)) {
    return ts.isExternalModuleReference(statement.moduleReference);
  }
  if (ts.isExportDeclaration(statement)) {
    return statement.moduleSpecifier !== undefined;
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.every(
      (declaration) =>
        declaration.initializer !== undefined &&
        isRequireCall(declaration.initializer),
    );
  }

  return false;
}

function fileContextHash(sourceFile: Ts.SourceFile): string {
  const statements = sourceFile.statements.filter(
    (statement) =>
      !isImportStatement(statement) && !isDeclarationStatement(statement),
  );

  return hashSourceGroups([textsOf(statements, sourceFile)]);
}

interface SourceFileWithParseDiagnostics {
  readonly parseDiagnostics?: readonly Ts.DiagnosticWithLocation[];
}

/**
 * `parseDiagnostics` is not part of the public typings, but it is the only way
 * to read the parser's own errors without building a Program around a single
 * file. If a TypeScript upgrade ever drops it, the syntax error spec fails.
 */
function firstSyntaxError(sourceFile: Ts.SourceFile): string | undefined {
  const ts = loadTypescript();
  const diagnostics =
    (sourceFile as unknown as SourceFileWithParseDiagnostics)
      .parseDiagnostics ?? [];
  const [first] = diagnostics;
  if (first === undefined) return undefined;

  const message = ts.flattenDiagnosticMessageText(first.messageText, ' ');
  return `line ${lineOf(sourceFile, first.start)}: ${message}`;
}

function extensionOf(filePath: string): string {
  const name = filePath.slice(
    Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1,
  );
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

/**
 * Enumerates the it/test declarations of one JavaScript or TypeScript test
 * file from its syntax alone. Pure: it reads nothing but its input and never
 * throws, an unsupported file or one that does not parse comes back as a
 * typed result. The compiler is loaded on the first call.
 */
export function parseTestDeclarations(
  input: ParseTestDeclarationsInput,
): ParseTestDeclarationsResult {
  const scriptKind = SCRIPT_KIND_BY_EXTENSION.get(extensionOf(input.filePath));
  if (scriptKind === undefined) {
    return { kind: 'unsupported', reason: 'unsupported-extension' };
  }

  const maxContentLength = input.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;
  if (input.content.length > maxContentLength) {
    return { kind: 'unsupported', reason: 'too-large' };
  }

  try {
    const ts = loadTypescript();
    const sourceFile = ts.createSourceFile(
      input.filePath,
      input.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind[scriptKind],
    );

    const syntaxError = firstSyntaxError(sourceFile);
    if (syntaxError !== undefined) {
      return { kind: 'error', reason: 'syntax-error', message: syntaxError };
    }

    return {
      kind: 'parsed',
      runner: detectTestRunner(sourceFile, input.runnerHint),
      declarations: collectDeclarations(sourceFile),
      fileContextHash: fileContextHash(sourceFile),
    };
  } catch (error) {
    return {
      kind: 'error',
      reason: 'parser-failure',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
