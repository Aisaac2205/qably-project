import { truncateTo } from '../../../../common/text/truncate-to';
import {
  MAX_CASE_NAME_LENGTH,
  resolveCaseIdentityKey,
} from '../../../runs/lib/case-identity';
import type { TestDeclaration } from './parse-test-declarations';

// The classname cap of runs/lib/parse-junit-xml.ts (MAX_CLASS_NAME_LENGTH),
// applied before the identity is built. The parity spec fails if they drift.
const JUNIT_CLASS_NAME_LENGTH = 250;

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
  | { readonly runner: 'jest' }
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

export type AutomationKeyResult =
  | {
      readonly kind: 'key';
      readonly key: string;
      /** The key holds the template; each reported row renders its own key. */
      readonly parametrized: boolean;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: 'dynamic-title' | 'outside-path-base';
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
 * The key the runs side stores for this testcase: the XML parser trims both
 * attributes, the ingestion cuts them at its caps, and the identity rule
 * composes classname and name only when one is not a prefix of the other.
 */
function ingestedKey(className: string, name: string): string {
  return resolveCaseIdentityKey({
    name: truncateTo(name.trim(), MAX_CASE_NAME_LENGTH),
    className: truncateTo(className.trim(), JUNIT_CLASS_NAME_LENGTH),
  });
}

// jest-junit fills its templates with String.prototype.replace, so a "$"
// pattern in a title renders the way it does here, not as written.
function jestJunitName(describePath: readonly string[], title: string): string {
  return JEST_JUNIT_TEMPLATE.replace(
    '{classname}',
    describePath.join(JEST_JUNIT_ANCESTOR_SEPARATOR),
  ).replace('{title}', title);
}

/**
 * The automationKey CI results carry for a declaration, by the reporter
 * conventions of extraction-prompt.ts (AUTOMATION_KEY_RULES):
 * - vitest's JUnit reporter: `<path relative to the vitest root>::<describe
 *   chain and title joined by " > ">`;
 * - jest-junit with its default templates: the describe chain and the title
 *   joined by a single space.
 */
export function deriveAutomationKey(
  declaration: AutomationKeyDeclaration,
  options: AutomationKeyOptions,
): AutomationKeyResult {
  if (declaration.dynamicTitle || declaration.dynamicDescribePath) {
    return { kind: 'unavailable', reason: 'dynamic-title' };
  }

  if (options.runner === 'jest') {
    const name = jestJunitName(declaration.describePath, declaration.title);
    return {
      kind: 'key',
      key: ingestedKey(name, name),
      parametrized: declaration.parametrized,
    };
  }

  const relativePath = pathRelativeToBase(options.filePath, options.pathBase);
  if (relativePath === null) {
    return { kind: 'unavailable', reason: 'outside-path-base' };
  }

  const name = [...declaration.describePath, declaration.title].join(
    VITEST_NAME_SEPARATOR,
  );

  return {
    kind: 'key',
    key: ingestedKey(relativePath, name),
    parametrized: declaration.parametrized,
  };
}
