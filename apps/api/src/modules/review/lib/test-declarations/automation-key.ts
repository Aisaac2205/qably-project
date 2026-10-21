import type { TestDeclaration } from './parse-test-declarations';
import { storedIdentityKey } from './stored-identity';

const VITEST_NAME_SEPARATOR = ' > ';
const JEST_JUNIT_ANCESTOR_SEPARATOR = ' ';
const JEST_JUNIT_TEMPLATE = '{classname} {title}';

export type AutomationKeyDeclaration = Pick<
  TestDeclaration,
  | 'title'
  | 'dynamicTitle'
  | 'describePath'
  | 'dynamicDescribePath'
  | 'parametrized'
>;

export type AutomationKeyOptions =
  | {
      readonly runner: 'jest';
      /** The jest project's `displayName`, when the config sets one. */
      readonly displayName?: string;
    }
  | {
      readonly runner: 'vitest';
      /** Repository-relative path of the test file, as CodeChange stores it. */
      readonly filePath: string;
      /**
       * Repository-relative directory vitest runs from (its `root`), which
       * its JUnit classname is relative to: `apps/web` for a package of a
       * monorepo, `''` when vitest runs from the repository root. The file
       * alone does not say which, so the caller has to.
       */
      readonly pathBase: string;
    };

export type AutomationKeyUnavailableReason =
  /** A title in the chain is computed at runtime. */
  | 'dynamic-title'
  /** The declaration's own title is empty or only whitespace. */
  | 'empty-title'
  /** The vitest file is not under `pathBase`. */
  | 'outside-path-base'
  /** The ingestion would store no key for it (see `storedIdentityKey`). */
  | 'not-ingestible';

export type AutomationKeyResult =
  | {
      readonly kind: 'key';
      readonly key: string;
      /** The key holds the template; each reported row renders its own key. */
      readonly parametrized: boolean;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: AutomationKeyUnavailableReason;
    };

function normalizePath(path: string): string {
  const normalized = path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+|\/+$/g, '');

  return normalized === '.' ? '' : normalized;
}

function pathRelativeToBase(filePath: string, pathBase: string): string | null {
  const file = normalizePath(filePath);
  const base = normalizePath(pathBase);
  if (base === '') return file;

  return file.startsWith(`${base}/`) ? file.slice(base.length + 1) : null;
}

/**
 * The characters vitest's escapeXML drops from every attribute: C0 controls
 * other than tab, line feed and carriage return, the discouraged C1 range,
 * U+FDD0-U+FDEF, U+FFFD, U+FFFE and U+FFFF. Its handling of lone surrogates
 * and of astral noncharacters is not mirrored.
 */
function isDroppedByVitest(codePoint: number): boolean {
  return (
    codePoint <= 0x08 ||
    codePoint === 0x0b ||
    codePoint === 0x0c ||
    (codePoint >= 0x0e && codePoint <= 0x1f) ||
    (codePoint >= 0x7f && codePoint <= 0x84) ||
    (codePoint >= 0x86 && codePoint <= 0x9f) ||
    (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
    (codePoint >= 0xfffd && codePoint <= 0xffff)
  );
}

function vitestAttribute(value: string): string {
  return Array.from(value)
    .filter((character) => !isDroppedByVitest(character.codePointAt(0) ?? 0))
    .join('');
}

/**
 * jest-junit fills its templates with String.prototype.replace, one variable
 * at a time in the order filepath, filename, suitename, classname, title,
 * displayName. Only the last three can touch the default template, so a "$"
 * pattern in a title renders the way the reporter renders it, and a literal
 * "{displayName}" in a title becomes the display name ("undefined" without
 * one), exactly as in the report.
 */
function jestJunitName(
  describePath: readonly string[],
  title: string,
  displayName: string | undefined,
): string {
  return JEST_JUNIT_TEMPLATE.replace(
    '{classname}',
    describePath.join(JEST_JUNIT_ANCESTOR_SEPARATOR),
  )
    .replace('{title}', title)
    .replace('{displayName}', String(displayName));
}

function toResult(
  key: string | undefined,
  parametrized: boolean,
): AutomationKeyResult {
  return key === undefined
    ? { kind: 'unavailable', reason: 'not-ingestible' }
    : { kind: 'key', key, parametrized };
}

/**
 * The automationKey CI results carry for a declaration, by the reporter
 * conventions of extraction-prompt.ts (AUTOMATION_KEY_RULES):
 * - vitest's JUnit reporter: `<path relative to the vitest root>::<describe
 *   chain and title joined by " > ">`;
 * - jest-junit with its default templates: the describe chain and the title
 *   joined by a single space.
 * Both go through `storedIdentityKey`, the steps the ingestion applies.
 */
export function deriveAutomationKey(
  declaration: AutomationKeyDeclaration,
  options: AutomationKeyOptions,
): AutomationKeyResult {
  if (declaration.dynamicTitle || declaration.dynamicDescribePath) {
    return { kind: 'unavailable', reason: 'dynamic-title' };
  }
  if (declaration.title.trim() === '') {
    return { kind: 'unavailable', reason: 'empty-title' };
  }

  if (options.runner === 'jest') {
    const name = jestJunitName(
      declaration.describePath,
      declaration.title,
      options.displayName,
    );
    return toResult(
      storedIdentityKey({ name, className: name }),
      declaration.parametrized,
    );
  }

  const relativePath = pathRelativeToBase(options.filePath, options.pathBase);
  if (relativePath === null) {
    return { kind: 'unavailable', reason: 'outside-path-base' };
  }

  const name = [...declaration.describePath, declaration.title].join(
    VITEST_NAME_SEPARATOR,
  );

  return toResult(
    storedIdentityKey({
      name: vitestAttribute(name),
      className: vitestAttribute(relativePath),
    }),
    declaration.parametrized,
  );
}
