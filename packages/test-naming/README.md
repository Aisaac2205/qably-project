# @qably/test-naming

Shared utility library for parsing, sanitizing, and humanizing automated test signatures and suite identifiers.

## Overview

Automated test cases in codebases and JUnit XML reports often use programmatic naming patterns such as snake_case, camelCase, or verbose prefixes (`test_`, `it_should_`). This package transforms those strings into readable, human-friendly titles suitable for QA management and business stakeholders.

## Key Features

- **Test Name Humanization:** Converts automated test identifiers into natural declarative titles while preserving technical terms.
- **Suite Title Normalization:** Cleans file paths and class names into clean test suite names.
- **Lexicon and Abbreviations:** Preserves common engineering abbreviations (such as API, HTTP, UUID, OAuth, and DB) during case conversion.
- **Sanitization:** Removes test runner artifacts, control characters, and regex markers.

## Exported Functions

- `humanizeTestName(rawName)`: Converts raw test descriptions into polished test case titles.
- `humanizeSuiteName(rawSuite)`: Transforms class names and file paths into standardized suite titles.
- `sanitize(input)`: Cleans unexpected formatting and special characters from input strings.

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
