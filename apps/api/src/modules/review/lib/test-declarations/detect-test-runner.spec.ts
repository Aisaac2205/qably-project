import type { TestRunner } from './detect-test-runner';
import { parseTestDeclarations } from './parse-test-declarations';

function runnerOf(content: string, runnerHint?: TestRunner) {
  const result = parseTestDeclarations({
    filePath: 'src/cart.test.ts',
    content,
    runnerHint,
  });
  if (result.kind !== 'parsed') {
    throw new Error(`expected a parsed result, got ${result.kind}`);
  }
  return result.runner;
}

describe('test runner detection', () => {
  it.each([
    ["import { it, expect } from 'vitest';"],
    ["import type { Mock } from 'vitest';"],
    ["import * as vitest from 'vitest';"],
    ["const { it } = require('vitest');"],
  ])('detects vitest from an import of vitest: %s', (source) => {
    expect(runnerOf(`${source}\nit('a', () => {});`)).toEqual({
      runner: 'vitest',
      evidence: 'import',
    });
  });

  it.each([
    ["import { jest, it } from '@jest/globals';"],
    ["const { it } = require('@jest/globals');"],
  ])('detects jest from an import of @jest/globals: %s', (source) => {
    expect(runnerOf(`${source}\nit('a', () => {});`)).toEqual({
      runner: 'jest',
      evidence: 'import',
    });
  });

  it('detects vitest from a vi API call when the file relies on globals', () => {
    expect(runnerOf("const spy = vi.fn();\nit('a', () => {});")).toEqual({
      runner: 'vitest',
      evidence: 'api',
    });
  });

  it.each([
    ["const spy = jest.fn();\nit('a', () => {});"],
    ["jest.mock('./cart');\nit('a', () => {});"],
    ["beforeEach(() => jest.useFakeTimers());\nit('a', () => {});"],
  ])(
    'detects jest from a jest API call when the file relies on globals',
    (source) => {
      expect(runnerOf(source)).toEqual({ runner: 'jest', evidence: 'api' });
    },
  );

  it('detects jest from its API namespace in a type position', () => {
    expect(runnerOf("let spy: jest.Mock;\nit('a', () => {});")).toEqual({
      runner: 'jest',
      evidence: 'api',
    });
  });

  it('does not take a subpath import such as vitest/config as evidence', () => {
    expect(
      runnerOf(
        "import { defineConfig } from 'vitest/config';\nit('a', () => {});",
      ),
    ).toEqual({ runner: 'unknown', evidence: 'none' });
  });

  it('reports unknown for a file that only uses the shared globals', () => {
    expect(
      runnerOf(
        "describe('Cart', () => {\n  it('a', () => { expect(1).toBe(1); });\n});",
      ),
    ).toEqual({ runner: 'unknown', evidence: 'none' });
  });

  it('falls back to the caller hint when the file has no evidence of its own', () => {
    expect(runnerOf("it('a', () => {});", 'jest')).toEqual({
      runner: 'jest',
      evidence: 'hint',
    });
  });

  it('prefers the evidence in the file over the caller hint', () => {
    expect(
      runnerOf("import { it } from 'vitest';\nit('a', () => {});", 'jest'),
    ).toEqual({ runner: 'vitest', evidence: 'import' });
  });

  it('prefers an import over an API call of the other runner', () => {
    expect(
      runnerOf(
        "import { it } from 'vitest';\nconst spy = jest.fn();\nit('a', () => {});",
      ),
    ).toEqual({ runner: 'vitest', evidence: 'import' });
  });

  it('treats imports of both runners as no import evidence and moves on to the next signal', () => {
    const both =
      "import { it } from 'vitest';\nimport { expect } from '@jest/globals';\n";

    expect(runnerOf(`${both}const spy = vi.fn();`)).toEqual({
      runner: 'vitest',
      evidence: 'api',
    });
    expect(runnerOf(both, 'jest')).toEqual({
      runner: 'jest',
      evidence: 'hint',
    });
    expect(runnerOf(both)).toEqual({ runner: 'unknown', evidence: 'none' });
  });

  it('treats API calls of both runners as no API evidence', () => {
    expect(runnerOf('vi.fn();\njest.fn();')).toEqual({
      runner: 'unknown',
      evidence: 'none',
    });
  });
});
