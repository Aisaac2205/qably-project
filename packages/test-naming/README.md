# @qably/test-naming

Shared utility library for parsing, sanitizing, and humanizing automated test signatures and suite identifiers.

## Overview

Automated test cases in codebases and JUnit XML reports often use programmatic naming patterns such as snake_case, camelCase, or verbose prefixes (`test_`, `it_should_`). This package transforms those strings into readable, human-friendly titles suitable for QA management and business stakeholders.

## Key Features

- **Test Name Humanization:** Splits identifiers on case boundaries and separators, drops filler prefixes, and sentence-cases the result. All-uppercase tokens of two or more characters, such as API, stay intact.
- **Convention Detection:** Recognizes the naming shapes of Vitest, Playwright, pytest, JUnit (Java), GoogleTest, and Jest JUnit reports, and splits the name into a path (describe blocks or class) and a leaf title. Bracketed or parenthesized arguments and leading invocation indexes are returned separately as a parameter.
- **Suite Title Normalization:** Cleans file paths and class names into clean test suite names by removing file extensions, Python test markers, and `Test` or `Tests` class suffixes.
- **Lexicon:** `src/lexicon.ts` holds the filler prefixes (`test`, `spec`, `it`, `prueba`, `caso`, and similar) and the sentence openers (`should`, `when`, `given`, `debería`, `cuando`, and similar) in English and Spanish.
- **Sanitization:** Normalizes input to NFC, strips control characters, collapses whitespace, and clamps length: 500 characters of input, 200 for a test title, and 120 for a suite name.

## Exported Functions and Types

- `humanizeTestName(input)`: Takes `{ name, className?, filePath? }` and returns `{ title, path, raw, convention, parameter? }`. An empty name returns an empty title with convention `'unknown'`.
- `humanizeSuiteName(name)`: Transforms class names and file paths into a standardized suite title string.
- `detectConvention(name, className, filePath)`: Returns the detected `Convention`: `'vitest'`, `'playwright'`, `'pytest'`, `'junit-java'`, `'gtest'`, `'jest-junit'`, or `'unknown'`.
- `isIdentifier(value)` and `isDottedIdentifier(value)`: Check whether a string is a plain or dotted programmatic identifier.
- `Convention`, `HumanizedTest`, `TestNameInput`: The types of the values above.

`sanitize` is internal and not part of the package entry point.

## Available Scripts

Run scripts from this directory or from the root workspace using `pnpm --filter @qably/test-naming <command>`.

### Build

Compile TypeScript sources to `dist/`:

```bash
pnpm run build
```

### Type Checking

Verify typing without emitting files:

```bash
pnpm run type-check
```

### Testing

Run test suite with Vitest:

```bash
pnpm run test
```
