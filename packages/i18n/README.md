# @qably/i18n

Shared internationalization package providing locale resolution algorithms, language types, and translation dictionaries for English and Spanish.

## Overview

This package handles locale negotiation across both frontend and backend boundaries. It parses standard HTTP headers in `apps/api` and supplies UI dictionary strings for `apps/web`.

## Features

- **Standard Locale Negotiation:** Implements RFC 4647 and RFC 7231 language tag parsing. Quality weights (`q=0.8`) are parsed and sorted numerically to determine user preference.
- **Strict Typing:** Guarantees that only supported locales (`'en' | 'es'`) are resolved, falling back safely to `DEFAULT_LOCALE` (`'en'`).
- **Shared Dictionaries:** Exports standard English (`en.json`) and Spanish (`es.json`) message catalogs.

## Exported Functions and Constants

- `parseAcceptLanguage(header)`: Parses the `Accept-Language` header string and returns an array of language tags ordered by preference weight.
- `resolveLocale(...candidates)`: Accepts one or more candidate language strings (such as cookie values, URL parameters, or request headers) and returns the first matching supported locale.
- `DEFAULT_LOCALE`: Fallback locale (`'en'`).
- `en`, `es`: JSON translation dictionaries.

## Available Scripts

Run scripts from this directory or from the root workspace using `pnpm --filter @qably/i18n <command>`.

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

Run unit tests verifying locale parsing and fallback resolution:

```bash
pnpm run test
```
