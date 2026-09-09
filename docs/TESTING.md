# Test suite health

How the two suites are run, and why the web suite is configured the way it is. For the CI workflow itself, see `CI.md`.

## Running them

```
cd apps/api && npx jest --maxWorkers=2
cd apps/web && npx vitest run --maxWorkers=2
```

Two traps make a local run lie about its result:

- **`pnpm --filter @qably/web test -- --flag` does not do what it looks like.** pnpm forwards everything after `--` to the underlying binary as positional arguments, and both jest and vitest read a bare positional as a *test path pattern*. `pnpm --filter @qably/api test -- --maxWorkers=2` therefore matches zero test files, runs zero tests, and still exits `0`. Call the binary directly from the app directory instead.
- **Piping a long run into `tail`** leaves the output file empty until the process exits. The run looks hung; it is not.

The worker cap is not optional locally: an uncapped run saturates every core and overheats the development laptop. CI omits it deliberately (`CI.md`).

## `deps.optimizer` has to name the right mode

`apps/web/vitest.config.ts` declared the optimizer under `deps.optimizer.web`. Vitest has no `web` mode: it uses `optimizer.client` for the `jsdom` and `happy-dom` environments and `optimizer.ssr` for `node` and `edge`. Unknown keys are not validated, so the block was silently inert and every test file re-resolved `@phosphor-icons/react` — a barrel that re-exports thousands of icon modules — through Vite's transform pipeline.

Renaming the key to `client` is the entire fix. Measured on this machine with `--maxWorkers=2`:

| | before | after |
| --- | --- | --- |
| 16 files (`src/features/ai-review`) | 60.7s, import 85.1s | 23.2s, import 9.4s |
| full suite (159 files, 1088 tests) | ~500s, import 676s | 227.7s, import 95.6s |

The lesson generalises: when a Vitest suite spends the bulk of its wall time in `import` rather than in `tests`, suspect the optimizer before suspecting the tests.

## Where the remaining time goes

After the fix, the full run reports `import 95.6s, tests 70.3s, environment 211.6s, setup 30.4s`. `environment` is jsdom construction — roughly 1.3s for every one of the 159 files — and it is now the dominant term.

`vitest.config.ts` sets `environment: 'jsdom'` globally, so pure-logic files (title formatting, metric derivation, the i18n resolver) pay for a DOM they never touch. Moving them to `environment: 'node'` is the obvious next step and needs `test.projects`: `environmentMatchGlobs` was removed in Vitest 4. It is not a free change — a file's environment cannot be inferred from its extension (`use-auth.test.ts` renders hooks, `store.test.ts` persists to `localStorage`), and `src/test/setup.ts` itself calls `localStorage.clear()`, so a node project needs its own setup file.
