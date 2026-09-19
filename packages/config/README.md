# @qably/config

Shared workspace configuration package containing base TypeScript compiler definitions.

## Overview

This package guarantees consistent compilation targets, module resolution strategies, and strict type checking rules across every application and package in the Qably monorepo.

## Provided Configurations

- `tsconfig.base.json`: The foundation configuration extended by all projects in the workspace.

Key compiler settings enforced by `tsconfig.base.json`:

- Target: `ES2022`
- Module Resolution: `Bundler`
- Strict Type Checking: Enabled (`strict: true`)
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
