import * as ts from 'typescript';
import { hashDeclarationText } from './body-hash';
import {
  detectTestRunner,
  type RunnerDetection,
  type TestRunner,
} from './detect-test-runner';

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
  /** See `hashDeclarationText`. */
  readonly bodyHash: string;
}

export interface ParseTestDeclarationsInput {
  /** Used for its extension, which selects the grammar. */
  readonly filePath: string;
  readonly content: string;
  /** The runner of the file's package, used when the file names none. */
  readonly runnerHint?: TestRunner;
}

export type ParseTestDeclarationsResult =
  | {
      readonly kind: 'parsed';
      readonly runner: RunnerDetection;
      readonly declarations: readonly TestDeclaration[];
    }
  | { readonly kind: 'unsupported'; readonly reason: 'unsupported-extension' }
  | {
      readonly kind: 'error';
      readonly reason: 'syntax-error' | 'parser-failure';
      readonly message: string;
    };

const SCRIPT_KIND_BY_EXTENSION: ReadonlyMap<string, ts.ScriptKind> = new Map([
  ['.ts', ts.ScriptKind.TS],
  ['.mts', ts.ScriptKind.TS],
  ['.cts', ts.ScriptKind.TS],
  ['.tsx', ts.ScriptKind.TSX],
  ['.js', ts.ScriptKind.JS],
  ['.mjs', ts.ScriptKind.JS],
  ['.cjs', ts.ScriptKind.JS],
  ['.jsx', ts.ScriptKind.JSX],
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
}

function readCallee(expression: ts.Expression): CalleeChain | undefined {
  if (ts.isIdentifier(expression)) {
    return { base: expression.text, modifiers: [], awaitingInvocation: false };
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const inner = readCallee(expression.expression);
    if (inner === undefined || inner.awaitingInvocation) return undefined;

    const name = expression.name.text;
    if (!PLAIN_MODIFIERS.has(name) && !FACTORY_MODIFIERS.has(name)) {
      return undefined;
    }

    return {
      base: inner.base,
      modifiers: [...inner.modifiers, name as TestModifier],
      awaitingInvocation: FACTORY_MODIFIERS.has(name),
    };
  }

  if (
    ts.isCallExpression(expression) ||
    ts.isTaggedTemplateExpression(expression)
  ) {
    const inner = readCallee(
      ts.isCallExpression(expression) ? expression.expression : expression.tag,
    );
    if (inner === undefined || !inner.awaitingInvocation) return undefined;

    return { ...inner, awaitingInvocation: false };
  }

  return undefined;
}

type CallRole =
  | {
      readonly role: 'test';
      readonly kind: DeclarationKind;
      readonly modifiers: readonly TestModifier[];
    }
  | { readonly role: 'describe'; readonly modifiers: readonly TestModifier[] };

function classifyCall(call: ts.CallExpression): CallRole | undefined {
  if (call.arguments.length === 0) return undefined;

  const callee = readCallee(call.expression);
  if (callee === undefined || callee.awaitingInvocation) return undefined;

  const test = TEST_BASES.get(callee.base);
  if (test !== undefined) {
    return {
      role: 'test',
      kind: test.kind,
      modifiers: [...test.modifiers, ...callee.modifiers],
    };
  }

  const describe = DESCRIBE_BASES.get(callee.base);
  if (describe !== undefined) {
    return { role: 'describe', modifiers: [...describe, ...callee.modifiers] };
  }

  return undefined;
}

interface Title {
  readonly text: string;
  readonly dynamic: boolean;
}

function readTitle(node: ts.Expression, sourceFile: ts.SourceFile): Title {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, dynamic: false };
  }

  return { text: node.getText(sourceFile), dynamic: true };
}

interface DescribeScope {
  readonly title: Title;
  readonly parametrized: boolean;
}

function isParametrized(modifiers: readonly TestModifier[]): boolean {
  return modifiers.some((modifier) => TABLE_MODIFIERS.has(modifier));
}

function lineOf(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function toDeclaration(
  call: ts.CallExpression,
  role: Extract<CallRole, { role: 'test' }>,
  scopes: readonly DescribeScope[],
  sourceFile: ts.SourceFile,
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
  };
}

/**
 * Walks the whole file, not only top-level statements, so a declaration
 * nested in any expression is found with the describe scopes it is written
 * in. A test body is not searched: runners reject a declaration inside one.
 */
function collectDeclarations(sourceFile: ts.SourceFile): TestDeclaration[] {
  const declarations: TestDeclaration[] = [];

  const visit = (node: ts.Node, scopes: readonly DescribeScope[]): void => {
    if (ts.isCallExpression(node)) {
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

interface SourceFileWithParseDiagnostics {
  readonly parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
}

/**
 * `parseDiagnostics` is not part of the public typings, but it is the only way
 * to read the parser's own errors without building a Program around a single
 * file. If a TypeScript upgrade ever drops it, the syntax error spec fails.
 */
function firstSyntaxError(sourceFile: ts.SourceFile): string | undefined {
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
 * typed result.
 */
export function parseTestDeclarations(
  input: ParseTestDeclarationsInput,
): ParseTestDeclarationsResult {
  const scriptKind = SCRIPT_KIND_BY_EXTENSION.get(extensionOf(input.filePath));
  if (scriptKind === undefined) {
    return { kind: 'unsupported', reason: 'unsupported-extension' };
  }

  try {
    const sourceFile = ts.createSourceFile(
      input.filePath,
      input.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const syntaxError = firstSyntaxError(sourceFile);
    if (syntaxError !== undefined) {
      return { kind: 'error', reason: 'syntax-error', message: syntaxError };
    }

    return {
      kind: 'parsed',
      runner: detectTestRunner(sourceFile, input.runnerHint),
      declarations: collectDeclarations(sourceFile),
    };
  } catch (error) {
    return {
      kind: 'error',
      reason: 'parser-failure',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
