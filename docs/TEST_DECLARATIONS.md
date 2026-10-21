# Test Declarations — Reading a Test File Without the AI

`apps/api/src/modules/review/lib/test-declarations/` enumerates the `it`/`test` declarations of a
JavaScript or TypeScript test file from its syntax alone, with the TypeScript compiler API
(`ts.createSourceFile`, no type checking, no file system). For each declaration it returns the
title, the describe chain, a line span and a fingerprint of the code, and it derives the
`automationKey` CI results carry for it. It is pure and never throws.

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

if (result.kind === 'parsed' && result.runner.runner === 'vitest') {
  for (const declaration of result.declarations) {
    const key = deriveAutomationKey(declaration, {
      runner: 'vitest',
      filePath: 'apps/web/src/test/status-chip.test.tsx',
      pathBase: 'apps/web', // the directory vitest runs from
    });
    // key: { kind: 'key', key, parametrized } or { kind: 'unavailable', reason }
  }
}
```

## What `parseTestDeclarations` returns

| `kind` | When |
|--------|------|
| `parsed` | The file parsed. Carries `runner` and `declarations`, in source order. |
| `unsupported` | The extension is not `.ts .tsx .js .jsx .mjs .cjs .mts .cts` (`reason: 'unsupported-extension'`). |
| `error` | The parser reported a syntax error (`reason: 'syntax-error'`, `message: 'line N: …'`), or failed outright (`'parser-failure'`). |

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
| `bodyHash` | The fingerprint below. |

Recognized forms: `it(…)`, `it.only(…)`, chains such as `it.concurrent.only(…)`,
`it.each([…])(…)`, ``it.each`table`(…)``, `it.skip.each([…])(…)`, `test.for([…])(…)`,
`it.skipIf(cond)(…)`, `describe.each([…])(…)` and nested describes at any depth. Not
declarations: an `it`/`test` that is not called, a call without a title argument, the table call
`it.each([…])` on its own, a member that is not a modifier (`test.extend(…)`, `helper.it(…)`), and
anything inside a test body.

## Runner detection

| `evidence` | Signal | Example |
|------------|--------|---------|
| `import` | An import of `vitest` or `@jest/globals` (`import`, `import type`, `require`, `import()`). A subpath such as `vitest/config` does not count. | `import { it } from 'vitest'` |
| `api` | A member of the runner's API object, as a value or a type. | `vi.fn()`, `jest.mock()`, `jest.Mock` |
| `hint` | `runnerHint`, the runner of the file's package, for a file that relies on globals. | jest's `globals` |
| `none` | Nothing above: `runner` is `unknown`. | |

The file's own evidence beats the hint, and an import beats an API call. A level that points at
both runners is no evidence, so the decision moves on to the next one.

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
repository root. A file outside `pathBase` is `unavailable` with `reason: 'outside-path-base'`.

The key goes through the same steps the ingestion applies to a reported testcase, so it matches
byte for byte: both attributes trimmed (the XML parser trims attribute values), `name` cut at 372
characters and `classname` at 250, then `resolveCaseIdentityKey`. jest-junit fills its templates
with `String.prototype.replace`, so a `$$` in a jest title renders as `$`, exactly as the reporter
writes it. `automation-key.spec.ts` checks the derived key against `parseJunitXml` and
`resolveCaseIdentityKey` for both reporters.

A key cannot be derived when any title in the chain is dynamic: the result is `unavailable` with
`reason: 'dynamic-title'`.

## The body hash

`bodyHash` is the sha256 hex digest of the call expression's source text (from the `it`/`test`
token to the closing parenthesis, the `.each` table included), after two normalizations:

- line endings become `"\n"`, so CRLF and LF checkouts hash the same;
- trailing whitespace is trimmed from every line.

Everything else counts. A comment inside the call, a re-indented body, or a changed title changes
the hash. A comment above the call, a change to a sibling test, or a rename of the enclosing
describe does not (the describe rename changes the key instead).

## Limits

- **JavaScript and TypeScript only.** pytest, JUnit (Java/Kotlin), GoogleTest and Go files are
  `unsupported`; their cases still go through the AI.
- **Dynamic titles.** A title or describe title computed at runtime has no derivable key, and a
  loop that declares tests is read as one declaration.
- **Parametrized rows.** The reporter emits one result per rendered row (`adds 1 and 1`,
  `adds 2 and 2`), and the catalog holds one case per row. The parser cannot render rows: it
  returns the template key with `parametrized: true`, which matches no row whose title has a
  placeholder.
- **Static scope.** A test declared inside a helper function is read with the describe chain it is
  written in, not the one it is called from. Custom test functions (`const myTest =
  test.extend(…)`) are not recognized.
- **Non-default reporter settings.** A custom `classnameTemplate` (vitest) or `classNameTemplate`,
  `titleTemplate` or `ancestorSeparator` (jest-junit) produces keys these conventions do not.
- **Syntax only.** TypeScript syntax in a `.js` file is not reported as an error, and a JSX file
  saved as `.ts` is.
