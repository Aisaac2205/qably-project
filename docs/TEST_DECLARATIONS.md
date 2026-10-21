# Test Declarations — Reading a Test File Without the AI

`apps/api/src/modules/review/lib/test-declarations/` enumerates the `it`/`test` declarations of a
JavaScript or TypeScript test file from its syntax alone, with the TypeScript compiler API
(`ts.createSourceFile`, no type checking, no file system). For each declaration it returns the
title, the describe chain, a line span and fingerprints of the declaration and of what it runs
under, and it derives the `automationKey` CI results carry for it. It is pure and never throws.

It exists so change detection does not depend on the AI: which cases a file has, and whether a
case's code changed, are decided here; the AI is only asked to describe the cases that are new or
changed.

## Quick path

```ts
import {
  deriveAutomationKey,
  parseTestDeclarations,
} from './modules/review/lib/test-declarations';

const result = parseTestDeclarations({
  filePath: 'apps/web/src/test/status-chip.test.tsx',
  content,
  runnerHint: 'vitest', // optional: the runner of the file's package
});

if (result.kind === 'parsed') {
  // A declaration changed when any of these differs from the previous push:
  // declaration.bodyHash, declaration.contextHash, result.fileContextHash.
  for (const declaration of result.declarations) {
    if (result.runner.runner !== 'vitest') continue;
    const key = deriveAutomationKey(declaration, {
      runner: 'vitest',
      filePath: 'apps/web/src/test/status-chip.test.tsx',
      pathBase: 'apps/web', // the directory vitest runs from
    });
    // key: { kind: 'key', key, parametrized } or { kind: 'unavailable', reason }
  }
}
```

The compiler (about 9 MB of JavaScript) is loaded on the first call to `parseTestDeclarations`, not
when the module is imported, so it stays out of the API's boot.

## What `parseTestDeclarations` returns

| `kind` | When |
|--------|------|
| `parsed` | The file parsed. Carries `runner`, `declarations` in source order, and `fileContextHash`. |
| `unsupported` | The extension is not `.ts .tsx .js .jsx .mjs .cjs .mts .cts` (`reason: 'unsupported-extension'`), or the content is longer than `maxContentLength` UTF-16 code units, 1,000,000 by default (`reason: 'too-large'`). |
| `error` | The parser reported a syntax error (`reason: 'syntax-error'`, `message: 'line N: …'`), or failed outright, for example on nesting too deep for the stack (`'parser-failure'`). |

One `TestDeclaration`:

| Field | Meaning |
|-------|---------|
| `kind` | `it` or `test` (`xit`/`fit` are `it`, `xtest` is `test`). |
| `title` | The title as written: the cooked value of a string literal or a template without substitutions. |
| `dynamicTitle` | The title is anything else (`` `adds ${n}` ``, a variable, a call, a concatenation). `title` then holds its raw source text. |
| `describePath` | Enclosing `describe`/`context`/`suite` titles (and their `x`/`f` aliases), outermost first. A dynamic describe title is kept as raw source text. |
| `dynamicDescribePath` | At least one entry of `describePath` is raw source text. |
| `modifiers` | Modifiers chained on the declaration, in source order: `each`, `for`, `only`, `skip`, `todo`, `concurrent`, `sequential`, `shuffle`, `failing`, `fails`, `skipIf`, `runIf`. `xit`/`xtest` add `skip`, `fit` adds `only`. |
| `parametrized` | The declaration, or a describe around it, is `.each`/`.for`: it runs once per table row. |
| `startLine`, `endLine` | 1-based lines of the whole call expression, table included. |
| `bodyHash` | Fingerprint of the declaration itself, see *The hashes*. |
| `contextHash` | Fingerprint of what it runs under inside its describes, see *The hashes*. |

### What counts as a declaration

A call to `it`, `test` or an alias, with a title argument and a test function: the second argument,
or the third after an options object (`test('x', { timeout: 500 }, () => …)`). A test function is a
function expression or anything that can evaluate to one: `handler`, `helpers.handler`,
`fakeAsync(() => …)`. A literal cannot, so Playwright's `test.skip(isMobile, 'reason')` and
`it('a title')` without a function are not declarations. `.todo` is the exception: it needs no
function.

Recognized forms: `it(…)`, `it.only(…)`, chains such as `it.concurrent.only(…)`,
`it.each([…])(…)`, ``it.each`table`(…)``, `it.skip.each([…])(…)`, `test.for([…])(…)`,
`it.skipIf(cond)(…)`, `describe.each([…])(…)` and nested describes at any depth.

Not declarations: an `it`/`test` that is not called, the table call `it.each([…])` on its own, a
member that is not a modifier (`test.extend(…)`, `helper.it(…)`), and anything inside a test body
or a `beforeAll`/`beforeEach`/`afterAll`/`afterEach` hook, where runners reject declarations.

Recognition is by name. A custom test function bound to `test` or `it`, as in
`const test = base.extend({ … })`, is read like the original; one bound to another name
(`const myTest = base.extend(…)`) is not read at all.

## The hashes

All three are sha256 hex digests, after the same normalization: line endings become `"\n"`, so CRLF
and LF checkouts hash the same, and trailing whitespace is trimmed from every line. Everything else
counts, comments and indentation included.

| Hash | Covers | Does not cover |
|------|--------|----------------|
| `bodyHash` | The call expression's text, from the `it`/`test` token to the closing parenthesis, the `.each` table included. | Anything outside the call: a comment above it, a sibling, the enclosing describe. |
| `contextHash` | For each enclosing describe, outermost first: its factory arguments (the `describe.each` table, a `skipIf` condition) and every statement directly in its body that is not a nested describe or test, so its hooks, helpers, fixtures and constants. Then the declaration's own factory arguments. | Sibling declarations and the bodies of nested describes the declaration is not in. |
| `fileContextHash` (per file) | Every top-level statement that is not an import and not a describe/test call: top-level hooks, helpers, fixtures, `vi.mock`/`jest.mock` calls, constants. | Imports, `require` declarations and re-exports, and the describe/test calls themselves. |

A declaration has changed when any of the three differs from what the previous push recorded.

Trade-offs to keep in mind:

- `fileContextHash` is one value for the whole file: changing a top-level helper marks the file
  context of every declaration as changed, including those that never call the helper.
- A change made only of imports changes none of the hashes, even when it swaps what a name refers
  to. Code imported from another module is not covered either: an `it.each(cases)` whose `cases`
  comes from an import is unchanged when that other file changes.
- Trailing whitespace inside a multi-line string or template literal does change the runtime value,
  but the normalization trims it like any other trailing whitespace, so a change made only of that
  is not seen.
- A comment between statements belongs to no statement and is in no hash.

## Change detection

`apps/api/src/modules/review/lib/change-detection/` turns a parse into what a code change records
(see `docs/AI_EXTRACTION.md`, *Which tests of a file changed*). Each declaration gets a local id
made of its describe path, its title and its occurrence among the declarations with the same
path and title, in source order; line numbers are left out, so a test that only moved keeps its
id. `readDeclaredFile` refuses a source the reader truncated and a file in which the parser sees no
declaration, besides the `unsupported` and `error` results above: those files keep the whole-file
extraction.

`diffDeclarations` applies the rule of *The hashes* against the file's baseline push: a new id or a
different `bodyHash` or `contextHash` marks one declaration changed, a different `fileContextHash`
marks all of them, and ids only the baseline has are returned as removed. Only the changed
declarations are sent to the model, by describe path, title and line span, and
`matchTargetedCases` maps the answer back by the cited tag, then the automation key, then the line
span of the quoted excerpt.

## Runner detection

| `evidence` | Signal | Example |
|------------|--------|---------|
| `import` | An import of `vitest` or `@jest/globals` (`import`, `import type`, `export … from`, `require`, `import()`). A subpath such as `vitest/config` does not count. An import of another test framework (`@playwright/test`, `node:test`, `bun:test`, `mocha`, `ava`, `uvu`, `tap`) makes the runner `unknown`. | `import { it } from 'vitest'` |
| `api` | A member of the runner's API object, as a value or a type. | `vi.fn()`, `jest.mock()`, `jest.Mock` |
| `hint` | `runnerHint`, the runner of the file's package, for a file that relies on globals. | jest's `globals` |
| `none` | Nothing above: `runner` is `unknown`. | |

The file's own evidence beats the hint, and an import beats an API call. A level that points at
both vitest and jest is no evidence, so the decision moves on to the next one. An import of
another framework is evidence of its own and ranks above the hint: a Playwright, mocha or
`node:test` file is `unknown` even in a package whose runner is jest.

Playwright's `test.describe` is not read as a describe scope, so the declarations of a Playwright
file carry no describe path. Such a file is `unknown` anyway, and keys are only derived for vitest
and jest.

## The `automationKey` conventions

The key has to equal what CI results carry, because that is the key official cases are stored and
matched under (`resolveCaseIdentityKey` in `apps/api/src/modules/runs/lib/case-identity.ts`, see
`docs/RUN_INGESTION.md`, *Case identity*). These are the conventions `AUTOMATION_KEY_RULES` in
`apps/api/src/modules/ai/extraction-prompt.ts` tells the AI to follow:

| Runner | Reporter output | Key |
|--------|-----------------|-----|
| vitest | junit reporter: `classname` is the file path relative to vitest's `root`, `name` is the describe chain and the title joined by `" > "`. Not a prefix of each other, so the identity is composite. | `src/test/status-chip.test.tsx::StatusChip (global) > renders pass status with icon and label` |
| jest | jest-junit default templates: `classname` and `name` are both `"{classname} {title}"`, where `{classname}` is the describe chain joined by a single space. | `resolveCaseIdentityKey uses the raw name alone when no classname is reported` |

**vitest needs `pathBase`.** vitest writes the path relative to the directory it runs from, not
to the repository: this repository's web tests run from `apps/web`, so CI reports
`src/test/status-chip.test.tsx`, while the code change stores
`apps/web/src/test/status-chip.test.tsx`. Nothing in the file says where vitest runs, so the caller
passes it: `pathBase: 'apps/web'` for a package of a monorepo, `''` when vitest runs from the
repository root.

The rendered name and classname go through `storedIdentityKey`, which repeats what
`POST /runs/ingest/junit` does to a reported testcase:

1. the XML parser trims both attributes, and a testcase without a name is named by its classname;
2. the name is cut at 372 code points and the classname at 250, and an empty classname is dropped;
3. `ingestRunSchema` trims both again and rejects a value outside its limits, counted in UTF-16
   code units, which rejects the whole report group;
4. `resolveCaseIdentityKey` composes classname and name.

What each reporter does before that is reproduced too. jest-junit fills its templates with
`String.prototype.replace`, one variable at a time (filepath, filename, suitename, classname, title,
displayName), so a `$$` in a title renders as `$` and a literal `{displayName}` becomes the
project's display name (`"undefined"` without one; pass `displayName` for a jest project that sets
one). vitest drops the characters its `escapeXML` strips: C0 controls other than tab, line feed and
carriage return, the discouraged C1 range, U+FDD0–U+FDEF, U+FFFD, U+FFFE and U+FFFF.
`automation-key.spec.ts` checks the derived key against the key the ingestion stores: the real
jest-junit reporter, or vitest-shaped XML, through `parseJunitXml`, `ingestRunSchema` and
`resolveCaseIdentityKey`.

When no key can be derived the result is `unavailable` with a `reason`:

| `reason` | When |
|----------|------|
| `dynamic-title` | The title or a describe title is computed at runtime. |
| `empty-title` | The title is empty or only whitespace. |
| `outside-path-base` | The vitest file is not under `pathBase`. |
| `not-ingestible` | The ingestion would store no key: the name is empty after the steps above, or past the schema limit in UTF-16 code units. |

## Limits

- **JavaScript and TypeScript only.** pytest, JUnit (Java/Kotlin), GoogleTest and Go files are
  `unsupported`; their cases still go through the AI.
- **vitest and jest only.** Playwright, mocha, `node:test`, `bun:test` and the other frameworks
  above are detected as `unknown`, and no key is derived for them.
- **Dynamic titles.** A title or describe title computed at runtime has no derivable key, and a
  loop that declares tests is read as one declaration.
- **Parametrized rows.** The reporter emits one result per rendered row (`adds 1 and 1`,
  `adds 2 and 2`), and the catalog holds one case per row. The parser cannot render rows: it
  returns the template key with `parametrized: true`, which matches no row whose title has a
  placeholder.
- **Static scope.** A test declared inside a helper function is read with the describe chain it is
  written in, not the one it is called from, and the helper's own statements are context of
  wherever it is written.
- **Non-default reporter settings.** A custom `classnameTemplate` (vitest) or `classNameTemplate`,
  `titleTemplate` or `ancestorSeparator` (jest-junit) produces keys these conventions do not.
- **vitest character stripping is partial.** Its handling of lone surrogates and astral
  noncharacters is not reproduced.
- **Syntax only.** TypeScript syntax in a `.js` file is not reported as an error, and a JSX file
  saved as `.ts` is.
