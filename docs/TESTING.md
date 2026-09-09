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

`vitest.config.ts` sets `environment: 'jsdom'` globally, so pure-logic files (title formatting, metric derivation, the i18n resolver) pay for a DOM they never touch. There are two ways to spend that 211s, and both are still open:

- **Run pure-logic files under `environment: 'node'`.** This needs `test.projects`; `environmentMatchGlobs` was removed in Vitest 4. It is not free: a file's environment cannot be inferred from its extension (`use-auth.test.ts` renders hooks, `store.test.ts` persists to `localStorage`), so the node project needs an explicit include list, and `src/test/setup.ts` calls `localStorage.clear()`, so it needs its own setup file. About 22 of the 159 files are provably pure today, which caps the saving at roughly 15s of wall time.
- **Replace jsdom with happy-dom for every file.** happy-dom constructs much faster, so this attacks all 159 files rather than 14% of them, and the config change is one line. It is a new devDependency and a different DOM implementation, so the 1088 tests are the acceptance test for it. This is the larger lever and it has not been tried.

## The skipped suite

`apps/api/src/modules/ai/gemini.extractor.integration.spec.ts` reports as skipped on every run. That is deliberate: it is gated behind `describe.skip` unless `GEMINI_API_KEY` is set, because it calls the real Gemini API. Nothing is broken and it should stay skipped by default.

It is also the only end-to-end check of the extraction path that exists. Running it with a real key is the cheapest way to confirm that the extraction prompt still produces schema-valid cases after a prompt change:

```
cd apps/api && GEMINI_API_KEY=... npx jest --maxWorkers=2 gemini.extractor.integration
```

## Lint baselines

Both apps lint clean as of this change: `apps/api` reports 0 errors and 0 warnings, `apps/web` 0 errors and 4 warnings. All four are `@next/next/no-img-element` on externally hosted technology logos; clearing them means `next/image` plus a `remotePatterns` entry, which changes how those images are served.
