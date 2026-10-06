# @qably/config

Shared workspace configuration package containing base TypeScript compiler definitions.

## Overview

This package provides consistent compilation targets, module resolution strategies, and strict type checking rules for the workspace packages. `packages/i18n`, `packages/test-naming`, `packages/types`, and `packages/ui` extend it. `apps/api`, `apps/web`, and `apps/landing` keep their own `tsconfig.json` (the landing app extends `astro/tsconfigs/strict`).

## Provided Configurations

- `tsconfig.base.json`: The foundation configuration extended by the workspace packages listed above.

Key compiler settings set by `tsconfig.base.json`:

- Target: `ES2022`
- Module Resolution: `Bundler`
- Strict Type Checking: Enabled (`strict: true`), plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, and `noFallthroughCasesInSwitch`
- Declaration Maps: Enabled for seamless navigation across workspace package sources

## Usage

Extend the configuration in any workspace package or application `tsconfig.json`:

```json
{
  "extends": "@qably/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```
