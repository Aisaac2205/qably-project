# Suites and Runs Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Suites and Runs surfaces honest, non-overlapping and traceable — a suite documents what should be tested, a run records what happened once, and no user can rewrite a verdict a machine produced.

**Architecture:** Three moves, in dependency order. First close the write path so CI-sourced runs are read-only (server-enforced, client-reflected). Second stop rendering data the system does not have — hardcoded environments, empty step lists, synthesised IDs. Third replace the mock-store reads in both surfaces with the real `RunCase.testCaseId` → `TestCase.currentVersion` relation that already exists in the schema and is already populated by `ReviewService`.

**Tech Stack:** NestJS 11 + Prisma + PostgreSQL (`apps/api`), Next.js 16 + React 19 + TanStack Query + Base UI + Tailwind v4 (`apps/web`), shared contracts in `packages/types`, translations in `packages/i18n`. Jest for API, Vitest for web.

**Spec:** `CONTEXT.md` sections 1.6.1 (Alcances), 1.6.2 (Límites), 4.3.2 (Historias de usuario), 4.5.3 (Usabilidad). This plan implements the alignment between those sections and the code; the audit that produced it is summarised in "Findings" below.

## Global Constraints

- Colors only via CSS custom properties / Tailwind token utilities. Never hardcoded hex, rgb or oklch in components. Tokens live in `apps/web/src/app/globals.css`.
- Icons from `@phosphor-icons/react`. No lucide, no hand-rolled SVG paths.
- No inline code comments. Rationale belongs in `docs/`.
- All user-facing strings come from `packages/i18n`. Add keys to **both** `en.json` and `es.json`.
- `packages/i18n` must be rebuilt (`pnpm --filter @qably/i18n build`) after editing `src/*.json`, or the web app keeps serving stale `dist` output.
- Test runners must be capped: `npx jest --maxWorkers=2` (API), `npx vitest run --poolOptions.threads.maxThreads=2` (web).
- Every task ends in its own conventional commit. Never absorb unrelated worktree changes into a commit.
- Commit locally only. Do not push.

## Findings this plan closes

| ID | Finding | Location |
|----|---------|----------|
| R1 | `updateCaseStatus` has no `run.source` guard — a user can overwrite a CI verdict. Violates CONTEXT 1.6.1.4 ("sin intervención manual del equipo"). | `run-queries.service.ts:166` |
| R2 | `Ambiente: Staging` is a hardcoded literal; `Run` has no `environment` column. | `case-detail.tsx:37` |
| R3 | `case-detail.tsx` ignores the real `testCaseId` FK and synthesises `case-${c.id}` against the mock store, so the version badge always reads 1 and the library link never renders. | `case-detail.tsx:21-25` |
| R4 | Steps and Expected result render as empty `<ol>` / `<p>` when the source (JUnit) structurally cannot carry them. | `case-detail.tsx:60-80` |
| S7 | Same empty-state problem in suites: a "0 pasos" disclosure that expands to nothing. | `case-card.tsx:74` |
| S9 | `case-card.tsx` reads version and traceability from the mock store while `ReviewService` writes real `TraceabilityLink` rows. Closed by Task 6. | `case-card.tsx:27-30` |
| S1 | Bare `<SelectValue />` renders the raw value instead of the item label. | 4 files, 7 sites |
| S5 | `useCreateRun` has no `onError`; `empty-suite` fails silently. | `use-create-run.ts:14` |
| S6 | "Run this suite" stays enabled on a suite with zero cases. | `suite-detail.tsx:139` |
| S8 | `formatRelative` hardcodes the `en` locale and the string `'Never'`. | `suite-detail.tsx:25-28` |

**Out of scope:** closing the ingestion → AI → `ExtractedProposal` chain, and exposing the `review` module over HTTP. Those are one separate subsystem and belong in their own plan; Task 6 here is written so it does not depend on them.

---

### Task 1: Server-side guard on CI run verdicts

A run whose `source` is not `manual` records what an external tool reported. Its case statuses are evidence, not opinion, so the API must refuse to edit them.

**Files:**
- Modify: `apps/api/src/modules/runs/runs.contracts.ts:9-13`
- Modify: `apps/api/src/modules/runs/run-queries.service.ts:166-186`
- Modify: `apps/api/src/modules/runs/run-queries.controller.ts:33-48`
- Test: `apps/api/src/modules/runs/run-queries.service.spec.ts`

**Interfaces:**
- Consumes: `RunQueriesService.scoped()` — already selects `source` via `RUN_SELECT`, no query change needed.
- Produces: `RunQueryError` gains the member `'source-not-editable'`, surfaced as HTTP 409.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('RunQueriesService.updateCaseStatus')` block in `apps/api/src/modules/runs/run-queries.service.spec.ts`. Match the fixture helpers already used by the neighbouring tests in that block.

```ts
it('refuses to edit a case in a run that came from CI', async () => {
  const prisma = createPrisma();
  prisma.run.findFirst.mockResolvedValue({
    ...runRow,
    source: 'github_actions',
  });

  const result = await build(prisma).updateCaseStatus(org, 'run-1', 'case-1', {
    status: 'pass',
  });

  expect(result).toEqual({ ok: false, error: 'source-not-editable' });
  expect(prisma.runCase.update).not.toHaveBeenCalled();
});

it('still edits a case in a manual run', async () => {
  const prisma = createPrisma();
  prisma.run.findFirst.mockResolvedValue({ ...runRow, source: 'manual' });

  const result = await build(prisma).updateCaseStatus(org, 'run-1', 'case-1', {
    status: 'pass',
  });

  expect(result.ok).toBe(true);
  expect(prisma.runCase.update).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && npx jest --maxWorkers=2 src/modules/runs/run-queries.service.spec.ts
```

Expected: the first test FAILS with `Received: {"ok": true, ...}`.

- [ ] **Step 3: Add the error member**

In `apps/api/src/modules/runs/runs.contracts.ts`:

```ts
export type RunQueryError =
  | 'not-found'
  | 'suite-not-found'
  | 'empty-suite'
  | 'case-not-found'
  | 'source-not-editable';
```

- [ ] **Step 4: Enforce the guard**

In `apps/api/src/modules/runs/run-queries.service.ts`, immediately after the existing `if (run === null) return err('not-found');` inside `updateCaseStatus`:

```ts
    if (run.source !== 'manual') return err('source-not-editable');
```

- [ ] **Step 5: Map the error to 409**

In `apps/api/src/modules/runs/run-queries.controller.ts`, add a branch to the `unwrap` switch and import `ConflictException` from `@nestjs/common`:

```ts
    case 'source-not-editable':
      throw new ConflictException(
        'Case statuses in an automated run are recorded by the reporting tool and cannot be edited',
      );
```

- [ ] **Step 6: Run the API suite**

```bash
cd apps/api && npx jest --maxWorkers=2 && npx tsc --noEmit
```

Expected: all suites pass, `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/runs/
git commit -m "fix(api): reject manual edits to automated run verdicts"
```

---

### Task 2: Expose the linked official case on a run case

Task 5 of the UI work needs the real version number and suite of the case a `RunCase` points at. The FK exists; only the read projection is missing.

**Files:**
- Modify: `packages/types/src/index.ts:172-182`
- Modify: `apps/api/src/modules/runs/lib/run-view.ts:21-31`
- Test: `apps/api/src/modules/runs/run-queries.service.spec.ts`

**Interfaces:**
- Produces: `RunCaseRecord.officialCase: { id: string; suiteId: string; version: number; steps: string[]; expectedResult: string } | null`. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Append to `describe('RunQueriesService.findOne')` in `apps/api/src/modules/runs/run-queries.service.spec.ts`:

```ts
it('projects the linked official case onto the run case', async () => {
  const prisma = createPrisma();
  prisma.runCase.findMany.mockResolvedValue([
    {
      ...caseRow,
      testCaseId: 'case-9',
      testCase: {
        id: 'case-9',
        suiteId: 'suite-1',
        steps: ['Open the cart'],
        expectedResult: 'The cart is empty',
        currentVersion: { version: 3 },
      },
    },
  ]);

  const result = await build(prisma).findOne(org, 'run-1');

  expect(result.ok).toBe(true);
  expect((result as { value: RunView }).value.cases[0].officialCase).toEqual({
    id: 'case-9',
    suiteId: 'suite-1',
    version: 3,
    steps: ['Open the cart'],
    expectedResult: 'The cart is empty',
  });
});

it('leaves officialCase null when the run case is unlinked', async () => {
  const prisma = createPrisma();
  prisma.runCase.findMany.mockResolvedValue([
    { ...caseRow, testCaseId: null, testCase: null },
  ]);

  const result = await build(prisma).findOne(org, 'run-1');

  expect((result as { value: RunView }).value.cases[0].officialCase).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && npx jest --maxWorkers=2 src/modules/runs/run-queries.service.spec.ts
```

Expected: FAIL — `officialCase` is `undefined`.

- [ ] **Step 3: Extend the shared type**

In `packages/types/src/index.ts`, add above `RunCaseRecord`:

```ts
export interface RunCaseOfficialCase {
  id: string
  suiteId: string
  version: number
  steps: string[]
  expectedResult: string
}
```

Then add the field to `RunCaseRecord`, after `testCaseId`:

```ts
  officialCase: RunCaseOfficialCase | null
```

- [ ] **Step 4: Widen the select and the mapper**

In `apps/api/src/modules/runs/lib/run-view.ts`, extend `CASE_SELECT`:

```ts
export const CASE_SELECT = {
  id: true,
  testCaseId: true,
  name: true,
  suiteName: true,
  steps: true,
  expectedResult: true,
  status: true,
  position: true,
  recordedAt: true,
  testCase: {
    select: {
      id: true,
      suiteId: true,
      steps: true,
      expectedResult: true,
      currentVersion: { select: { version: true } },
    },
  },
} as const;
```

Add the matching row field to `RunCaseRow` in the same file:

```ts
  testCase: {
    id: string;
    suiteId: string;
    steps: string[];
    expectedResult: string;
    currentVersion: { version: number } | null;
  } | null;
```

In the `RunCaseRow` → `RunCaseView` mapper in that file, add:

```ts
    officialCase:
      row.testCase === null
        ? null
        : {
            id: row.testCase.id,
            suiteId: row.testCase.suiteId,
            version: row.testCase.currentVersion?.version ?? 1,
            steps: row.testCase.steps,
            expectedResult: row.testCase.expectedResult,
          },
```

- [ ] **Step 5: Run the API suite and typecheck**

```bash
cd apps/api && npx jest --maxWorkers=2 && npx tsc --noEmit
```

Expected: all pass. If `tsc` reports the Prisma client does not know `currentVersion`, run `npx prisma generate` first — migrations do not regenerate the client.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts apps/api/src/modules/runs/
git commit -m "feat(api): project the linked official case onto run cases"
```

---

### Task 3: Reflect the guard in the run workspace

The server now refuses; the UI must stop offering. On an automated run the shortcut bar becomes an explanation instead of a control panel.

**Files:**
- Modify: `apps/web/src/features/runs/components/run-detail.tsx:19-120`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/es.json`
- Test: `apps/web/src/features/runs/test/run-detail.test.tsx`

**Interfaces:**
- Consumes: `RunRecord.source` from `@qably/types` — already present.
- Produces: nothing downstream.

- [ ] **Step 1: Add the translation keys**

In the `runs` object of `packages/i18n/src/en.json`:

```json
"readOnlyRun": "Recorded by {{source}}",
"readOnlyRunHint": "Statuses in an automated run come from the reporting tool and cannot be edited here."
```

In `packages/i18n/src/es.json`:

```json
"readOnlyRun": "Registrado por {{source}}",
"readOnlyRunHint": "Los estados de una ejecución automatizada provienen de la herramienta que los reportó y no pueden editarse aquí."
```

- [ ] **Step 2: Rebuild the i18n package**

```bash
pnpm --filter @qably/i18n build
```

- [ ] **Step 3: Write the failing test**

In `apps/web/src/features/runs/test/run-detail.test.tsx`, following the render helpers already in that file:

```tsx
it('hides the shortcut bar on an automated run', () => {
  render(<RunDetail projectId="p1" run={{ ...runFixture, source: 'github_actions' }} />)

  expect(screen.queryByLabelText('Keyboard shortcuts')).not.toBeInTheDocument()
  expect(screen.getByText(/cannot be edited here/i)).toBeInTheDocument()
})

it('does not change a case status on keypress in an automated run', async () => {
  render(<RunDetail projectId="p1" run={{ ...runFixture, source: 'github_actions' }} />)

  await userEvent.keyboard('p')

  expect(updateRunCaseSpy).not.toHaveBeenCalled()
})

it('keeps the shortcut bar on a manual run', () => {
  render(<RunDetail projectId="p1" run={{ ...runFixture, source: 'manual' }} />)

  expect(screen.getByLabelText('Keyboard shortcuts')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/runs/test/run-detail.test.tsx
```

Expected: FAIL — the shortcut bar renders for every source.

- [ ] **Step 5: Gate the interactions**

In `apps/web/src/features/runs/components/run-detail.tsx`, after `const updateStatus = useUpdateRunCase(run.id)`:

```tsx
  const isEditable = run.source === 'manual'
```

Pass the flag to the shortcut hook:

```tsx
  useKeyboardShortcuts(
    {
      p: () => setStatus('pass'),
      f: () => setStatus('fail'),
      s: () => setStatus('skip'),
      b: () => setStatus('blocked'),
      ArrowRight: () => goNext(),
      ArrowLeft: () => goPrev(),
      r: () => runNext(),
    },
    { enabled: isEditable },
  )
```

Replace the shortcut hint block with a conditional. `SOURCE_LABELS` mirrors the map already in `run-progress-header.tsx`:

```tsx
  const SOURCE_LABELS: Record<string, string> = {
    manual: 'runs.sourceManual',
    api: 'runs.sourceApi',
    github_actions: 'runs.sourceCi',
  }

  {isEditable ? (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-xl border border-border bg-surface shadow-xs text-xs"
      aria-label={t('runs.keyboardShortcuts')}
    >
      <span className="text-xs font-semibold text-muted">{t('runs.shortcuts')}</span>
      {SHORTCUT_LABELS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-default">
          <kbd className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded border border-border bg-surface-hover text-default shadow-sm min-w-[20px] text-center">
            {s.key}
          </kbd>
          <span className="text-muted">{s.label}</span>
        </span>
      ))}
    </div>
  ) : (
    <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-border bg-canvas/60 text-xs">
      <LockSimple size={14} weight="bold" className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-semibold text-default">
          {t('runs.readOnlyRun', { source: t(SOURCE_LABELS[run.source] ?? 'runs.sourceApi') })}
        </p>
        <p className="text-muted">{t('runs.readOnlyRunHint')}</p>
      </div>
    </div>
  )}
```

Add `LockSimple` to the existing `@phosphor-icons/react` import.

- [ ] **Step 6: Run the web tests and typecheck**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/runs && npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/runs/ packages/i18n/src/
git commit -m "feat(web): make automated runs read-only in the run workspace"
```

---

### Task 4: Stop rendering data the system does not have

Removes the invented environment and the two empty content blocks. An auditing tool must never state something it cannot prove.

**Files:**
- Modify: `apps/web/src/features/runs/components/case-detail.tsx:28-80`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/es.json`
- Test: `apps/web/src/features/runs/test/case-detail.test.tsx`

**Interfaces:**
- Consumes: `RunCaseRecord.steps`, `RunCaseRecord.expectedResult`.
- Produces: nothing downstream.

- [ ] **Step 1: Add the translation keys**

In the `runs` object of `packages/i18n/src/en.json`:

```json
"undocumentedCase": "Discovered from the test report",
"undocumentedCaseHint": "This case was created from the name the reporting tool sent. It has no documented steps yet."
```

In `packages/i18n/src/es.json`:

```json
"undocumentedCase": "Descubierto desde el reporte de pruebas",
"undocumentedCaseHint": "Este caso se creó a partir del nombre que envió la herramienta. Todavía no tiene pasos documentados."
```

Rebuild: `pnpm --filter @qably/i18n build`

- [ ] **Step 2: Write the failing test**

In `apps/web/src/features/runs/test/case-detail.test.tsx`:

```tsx
it('does not render a steps section when the case has no steps', () => {
  render(<CaseDetail c={{ ...caseFixture, steps: [], expectedResult: '' }} />)

  expect(screen.queryByText('Steps')).not.toBeInTheDocument()
  expect(screen.queryByText('Expected result')).not.toBeInTheDocument()
  expect(screen.getByText(/no documented steps yet/i)).toBeInTheDocument()
})

it('renders the steps section when the case has steps', () => {
  render(<CaseDetail c={{ ...caseFixture, steps: ['Open the cart'] }} />)

  expect(screen.getByText('Steps')).toBeInTheDocument()
  expect(screen.getByText('Open the cart')).toBeInTheDocument()
})

it('never renders a hardcoded environment', () => {
  render(<CaseDetail c={caseFixture} run={runFixture} />)

  expect(screen.queryByText(/staging/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/runs/test/case-detail.test.tsx
```

Expected: FAIL on all three.

- [ ] **Step 4: Delete the environment badge**

In `apps/web/src/features/runs/components/case-detail.tsx`, remove this block entirely:

```tsx
          {run && (
            <span className="rounded bg-canvas border border-border px-2 py-0.5 text-xs font-medium text-muted">
              {t('runs.environment')}: <span className="text-default font-medium">Staging</span>
            </span>
          )}
```

- [ ] **Step 5: Make the content blocks conditional**

Replace the Steps and Expected result blocks with:

```tsx
      {c.steps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted">{t('runs.steps')}</h4>
          <ol className="space-y-1.5 list-decimal list-inside text-xs sm:text-sm text-default leading-relaxed bg-canvas/40 border border-border/60 rounded-lg p-3 sm:p-4">
            {c.steps.map((step, i) => (
              <li key={i} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {c.expectedResult !== '' && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted">{t('runs.expectedResult')}</h4>
          <p className="text-xs sm:text-sm text-default bg-canvas/40 border border-border/60 rounded-lg p-3 sm:p-4 leading-relaxed">
            {c.expectedResult}
          </p>
        </div>
      )}

      {c.steps.length === 0 && c.expectedResult === '' && (
        <div className="space-y-1 rounded-lg border border-dashed border-border bg-canvas/40 p-3 sm:p-4">
          <p className="text-xs font-semibold text-default">{t('runs.undocumentedCase')}</p>
          <p className="text-xs text-muted leading-relaxed">{t('runs.undocumentedCaseHint')}</p>
        </div>
      )}
```

- [ ] **Step 6: Run the web tests**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/runs && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/runs/ packages/i18n/src/
git commit -m "fix(web): stop rendering invented run case data"
```

---

### Task 5: Wire the run case to its real official case

Replaces the synthesised `case-${c.id}` mock lookups with the projection Task 2 added. This is the Suite ↔ Run bridge the thesis calls traceability.

**Files:**
- Modify: `apps/web/src/features/runs/components/case-detail.tsx:1-50`
- Test: `apps/web/src/features/runs/test/case-detail.test.tsx`

**Interfaces:**
- Consumes: `RunCaseRecord.officialCase` from Task 2.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows the real version of the linked official case', () => {
  render(
    <CaseDetail
      c={{
        ...caseFixture,
        testCaseId: 'case-9',
        officialCase: {
          id: 'case-9',
          suiteId: 'suite-1',
          version: 4,
          steps: [],
          expectedResult: '',
        },
      }}
      projectId="p1"
    />,
  )

  expect(screen.getByText('Version 4')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute(
    'href',
    '/projects/p1/suites/suite-1',
  )
})

it('hides the version badge and library link when the case is unlinked', () => {
  render(<CaseDetail c={{ ...caseFixture, testCaseId: null, officialCase: null }} projectId="p1" />)

  expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /library/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/runs/test/case-detail.test.tsx
```

Expected: FAIL — the badge always reads `Version 1`.

- [ ] **Step 3: Drop the mock store**

In `apps/web/src/features/runs/components/case-detail.tsx`, delete this import:

```tsx
import { useOfficialTestCase, useTestCaseVersion, useTraceabilityLinks } from '@/lib/use-mock-store'
```

and delete these five lines from the component body:

```tsx
  const officialCaseId = `case-${c.id}`
  const officialCase = useOfficialTestCase(officialCaseId)
  const currentVersionId = officialCase?.currentVersionId ?? `version-${c.id}-1`
  const version = useTestCaseVersion(currentVersionId)
  const links = useTraceabilityLinks(officialCaseId)
```

- [ ] **Step 4: Read the real projection**

Add in their place:

```tsx
  const officialCase = c.officialCase
```

Make the version badge conditional:

```tsx
          {officialCase && (
            <span className="rounded bg-canvas border border-border px-2 py-0.5 font-mono text-xs font-semibold text-muted">
              {t('runs.versionSnapshot', { version: officialCase.version })}
            </span>
          )}
```

Point the library link at the real suite:

```tsx
          {projectId && officialCase && (
            <Link
              href={`/projects/${projectId}/suites/${officialCase.suiteId}`}
              className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline ml-auto"
            >
              <span>{t('runs.viewInLibrary')}</span>
              <ArrowSquareOut size={12} aria-hidden="true" />
            </Link>
          )}
```

Delete the whole `{links.length > 0 && ( ... )}` traceability block and the now-unused `TraceabilityTrail` and `GitCommit` imports. Real traceability links land with the review module plan; a mock trail is worse than none.

- [ ] **Step 5: Run the web tests and typecheck**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/runs && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/runs/
git commit -m "feat(web): link run cases to their real official case"
```

---

### Task 6: Honest suite cases on real data

The same rule as Task 4, applied to the other surface, plus the mock-store removal Task 5 did for runs. A `draft` case with no steps is the input the AI copilot is meant to consume, so it gets a call to action instead of an empty disclosure.

**Files:**
- Modify: `packages/types/src/index.ts:149-157`
- Modify: `apps/api/src/modules/suites/suites.service.ts:25-46`
- Modify: `apps/web/src/features/projects/suites/components/case-card.tsx:1-135`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/es.json`
- Test: `apps/api/src/modules/suites/suites.service.spec.ts`
- Test: `apps/web/src/features/projects/suites/test/case-card.test.tsx`

**Interfaces:**
- Consumes: `TestCase.steps`, `TestCase.state`.
- Produces: `TestCase.version: number` on the shared type, sourced from `currentVersion.version` and defaulting to `1`.

- [ ] **Step 1: Add the translation keys**

`packages/i18n/src/en.json`, `suites` object:

```json
"undocumentedCase": "No documented steps",
"documentCase": "Document this case"
```

`packages/i18n/src/es.json`:

```json
"undocumentedCase": "Sin pasos documentados",
"documentCase": "Documentar este caso"
```

Rebuild: `pnpm --filter @qably/i18n build`

- [ ] **Step 2: Write the failing test**

```tsx
it('offers to document a case that has no steps', async () => {
  const onEdit = vi.fn()
  render(<CaseCard testCase={{ ...caseFixture, steps: [] }} onEdit={onEdit} onDelete={vi.fn()} />)

  expect(screen.queryByText('0 steps')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /document this case/i }))

  expect(onEdit).toHaveBeenCalled()
})

it('keeps the steps disclosure when the case has steps', () => {
  render(
    <CaseCard testCase={{ ...caseFixture, steps: ['Open the cart'] }} onEdit={vi.fn()} onDelete={vi.fn()} />,
  )

  expect(screen.getByText('1 steps')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/projects/suites/test/case-card.test.tsx
```

Expected: FAIL — the "0 steps" disclosure still renders.

- [ ] **Step 4: Project the real version onto suite cases**

Add the field to `TestCase` in `packages/types/src/index.ts`:

```ts
  version: number
```

In `apps/api/src/modules/suites/suites.service.ts`, extend `CASE_SELECT` with `currentVersion: { select: { version: true } }`, add the matching optional field to `CaseRow`:

```ts
  currentVersion: { version: number } | null;
```

and set `version: row.currentVersion?.version ?? 1` in the `CaseRow` to view mapper. Add a test in `suites.service.spec.ts` asserting a case with no published version reports `version: 1` and one with `currentVersion.version === 3` reports `3`.

- [ ] **Step 5: Drop the mock store from the case card**

In `apps/web/src/features/projects/suites/components/case-card.tsx`, delete this import:

```tsx
import { useOfficialTestCase, useTestCaseVersion, useTraceabilityLinks } from '@/lib/use-mock-store'
```

and delete these five lines from the component body:

```tsx
  const officialCaseId = `case-${testCase.id}`
  const officialCase = useOfficialTestCase(officialCaseId)
  const currentVersionId = officialCase?.currentVersionId ?? `version-${testCase.id}-1`
  const currentVersion = useTestCaseVersion(currentVersionId)
  const links = useTraceabilityLinks(officialCaseId)
```

Read the projection instead in the version badge:

```tsx
        <span className="rounded bg-canvas border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
          v{testCase.version}
        </span>
```

Delete the traceability toggle button, the `{traceOpen && links.length > 0 && ( ... )}` block, the `traceOpen` state, and the now-unused `TraceabilityTrail` and `GitCommit` imports. Real links land with the review module plan; a mock trail is worse than none.

- [ ] **Step 6: Swap the disclosure for a call to action**

In `apps/web/src/features/projects/suites/components/case-card.tsx`, wrap the existing steps button in a conditional and add the empty branch:

```tsx
        {testCase.steps.length > 0 ? (
          <button
            onClick={() => setStepsOpen(!stepsOpen)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-default hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/70 border border-border/70 cursor-pointer"
            aria-expanded={stepsOpen}
            type="button"
          >
            {stepsOpen ? <CaretDown size={13} weight="bold" aria-hidden="true" /> : <CaretRight size={13} weight="bold" aria-hidden="true" />}
            {t('suites.stepsCount', { count: testCase.steps.length })}
          </button>
        ) : (
          <button
            onClick={() => onEdit(testCase)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/40 border border-dashed border-border cursor-pointer"
            type="button"
          >
            <PencilSimple size={13} weight="bold" aria-hidden="true" />
            {t('suites.documentCase')}
          </button>
        )}
```

- [ ] **Step 7: Run both suites and typecheck**

```bash
cd apps/api && npx jest --maxWorkers=2 && npx tsc --noEmit
cd ../web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/projects/suites && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add packages/types/src/index.ts apps/api/src/modules/suites/ apps/web/src/features/projects/suites/ packages/i18n/src/
git commit -m "feat(web): show real case versions and honest empty states in suites"
```

---

### Task 7: Fix every bare SelectValue

Base UI renders the raw value unless `Select.Root` receives `items`. The repo already solved this in `SelectSimple`; this task makes the wrapper safe so the bad usage stops being reachable.

**Files:**
- Modify: `apps/web/src/components/ui/select.tsx:17-32`
- Modify: `apps/web/src/features/projects/suites/components/suite-filter-bar.tsx:84-124`
- Modify: `apps/web/src/features/projects/suites/components/case-form-dialog.tsx:140-180`
- Modify: `apps/web/src/features/runs/components/new-run-form.tsx:66-84`
- Modify: `apps/web/src/features/integrations/components/create-notification-webhook-dialog.tsx:118-130`
- Test: `apps/web/src/test/select.test.tsx`

**Interfaces:**
- Produces: `SelectRootProps` now accepts `items?: ReadonlyArray<{ value: unknown; label: string }>`, forwarded to `Select.Root`.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/test/select.test.tsx`:

```tsx
it('renders the label of the selected item, not the raw value', () => {
  render(
    <Select value="recent" items={[{ value: 'recent', label: 'Most recent' }]}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="recent">Most recent</SelectItem>
      </SelectContent>
    </Select>,
  )

  expect(screen.getByText('Most recent')).toBeInTheDocument()
  expect(screen.queryByText('recent')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/test/select.test.tsx
```

Expected: FAIL — the trigger renders `recent`.

- [ ] **Step 3: Forward `items` through the wrapper**

`apps/web/src/components/ui/select.tsx` already spreads props into `SelectPrimitive.Root`, so `items` reaches Base UI once the type allows it:

```ts
export type SelectRootProps = React.ComponentProps<typeof SelectPrimitive.Root>
```

Confirm this resolves to a type that includes `items`. If Base UI's generic inference rejects the literal arrays used below, pass `items` as `SelectOption[]` and cast at the call site rather than widening the wrapper.

- [ ] **Step 4: Pass `items` at every call site**

`suite-filter-bar.tsx` — the option arrays already exist; pass them:

```tsx
      <Select value={status} items={STATUS_OPTIONS} onValueChange={(v) => onStatusChange(v as SuiteRunStatus | 'all')}>
```

```tsx
      <Select value={sort} items={SORT_OPTIONS} onValueChange={(v) => onSortChange(v as SortKey)}>
```

For the tag select, build the list from `availableTags`:

```tsx
  const TAG_OPTIONS = [
    { value: 'all', label: t('suites.allTags') },
    ...availableTags.map((tagItem) => ({ value: tagItem, label: tagItem })),
  ]
```

```tsx
      <Select value={tag} items={TAG_OPTIONS} onValueChange={(v) => onTagChange(String(v))}>
```

`case-form-dialog.tsx` — build both lists from the existing label maps:

```tsx
  const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: t(PRIORITY_LABEL[p]) }))
  const STATE_OPTIONS = STATES.map((s) => ({ value: s, label: t(STATE_LABEL[s]) }))
```

and pass `items={PRIORITY_OPTIONS}` / `items={STATE_OPTIONS}` to their respective `Select` roots.

`new-run-form.tsx` — this one currently shows a raw cuid:

```tsx
        <Select
          value={suiteId}
          items={suites.map((s) => ({ value: s.id, label: s.name }))}
          onValueChange={handleSuiteChange}
        >
```

`create-notification-webhook-dialog.tsx` — build the list from the two literal items it already renders:

```tsx
  const TYPE_OPTIONS = [
    { value: 'slack', label: t('settings.webhooks.typeSlack') },
    { value: 'discord', label: t('settings.webhooks.typeDiscord') },
  ]
```

```tsx
          <Select
            value={type}
            items={TYPE_OPTIONS}
            onValueChange={(value) => setType(value as NotificationWebhookType)}
          >
```

- [ ] **Step 5: Run the full web suite and typecheck**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/select.tsx apps/web/src/features/
git commit -m "fix(web): render select labels instead of raw values"
```

---

### Task 8: Close the manual run loop

A suite with no active cases cannot start a run; the server already says so and the client currently ignores it. Also fixes the hardcoded relative-time locale next to it.

**Files:**
- Modify: `apps/web/src/features/runs/hooks/use-create-run.ts:11-28`
- Modify: `apps/web/src/features/projects/suites/components/suite-detail.tsx:25-38,136-146`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/es.json`
- Test: `apps/web/src/features/projects/suites/test/suite-detail.test.tsx`

**Interfaces:**
- Consumes: HTTP 400 `empty-suite` from `run-queries.controller.ts`.
- Produces: nothing downstream.

- [ ] **Step 1: Add the translation key**

`packages/i18n/src/en.json`, `suites` object:

```json
"cannotRunEmptySuite": "Add at least one test case before running this suite"
```

`packages/i18n/src/es.json`:

```json
"cannotRunEmptySuite": "Agregá al menos un caso de prueba antes de ejecutar esta suite"
```

Rebuild: `pnpm --filter @qably/i18n build`

- [ ] **Step 2: Write the failing test**

```tsx
it('disables the run button on a suite with no cases', () => {
  renderSuiteDetail({ ...suiteFixture, cases: [] })

  expect(screen.getByRole('button', { name: /run this suite/i })).toBeDisabled()
})

it('enables the run button once the suite has a case', () => {
  renderSuiteDetail({ ...suiteFixture, cases: [caseFixture] })

  expect(screen.getByRole('button', { name: /run this suite/i })).toBeEnabled()
})

it('formats the last run time in the active locale', () => {
  renderSuiteDetail(suiteFixture, { locale: 'es' })

  expect(screen.queryByText('Never')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 src/features/projects/suites/test/suite-detail.test.tsx
```

Expected: FAIL — the button is always enabled.

- [ ] **Step 4: Disable the run button**

In `apps/web/src/features/projects/suites/components/suite-detail.tsx`, add `disabled` and a tooltip to the run button:

```tsx
            <Button
              type="button"
              disabled={suite.cases.length === 0}
              title={suite.cases.length === 0 ? t('suites.cannotRunEmptySuite') : undefined}
              onClick={() => router.push(`/projects/${projectId}/runs/new?suite=${suite.id}`)}
              className="text-sm font-semibold"
              size="default"
            >
              <Play size={14} weight="bold" aria-hidden="true" />
              {t('suites.runThisSuite')}
            </Button>
```

- [ ] **Step 5: Localise the relative time**

Replace the module-level `rtf` constant and the hardcoded `'Never'`. Move the formatter inside the component so it reads the active locale, and take the fallback from i18n:

```tsx
function formatRelative(iso: string | undefined, locale: string, never: string): string {
  if (!iso) return never
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((then - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}
```

Update the call site, reading `locale` from `useTranslation()`:

```tsx
              <span className="text-sm font-medium text-default">
                {formatRelative(metrics.lastRun?.startedAt, locale, t('suites.never'))}
              </span>
```

If `useTranslation()` does not expose `locale`, read it from the same source `apps/web/src/lib/i18n` uses to pick the dictionary rather than adding a second source of truth.

- [ ] **Step 6: Surface the run error**

In `apps/web/src/features/runs/hooks/use-create-run.ts`, add an `onError` to the mutation and return the error alongside the trigger:

```tsx
  const mutation = useMutation({
    mutationFn: ({ suiteId, name }: { suiteId: string; name?: string }) =>
      createRun({ projectId, suiteId, name }),
    onSuccess: async (run) => {
      queryClient.setQueryData(runKeys.detail(run.id), run)
      await queryClient.invalidateQueries({ queryKey: runKeys.all })
      router.push(`/projects/${projectId}/runs/${run.id}`)
    },
  })

  const start = useCallback(
    (suiteId: string, name?: string) => {
      mutation.mutate({ suiteId, name })
    },
    [mutation],
  )

  return { start, error: mutation.error }
```

Update `new-run-form.tsx` to consume the new shape and render `error` in the existing `role="alert"` span.

- [ ] **Step 7: Run the full web suite and typecheck**

```bash
cd apps/web && npx vitest run --poolOptions.threads.maxThreads=2 && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/ packages/i18n/src/
git commit -m "fix(web): block and explain runs on empty suites"
```

---

### Task 9: Document the boundary

The separation this plan enforces is not obvious from the code alone. Record it next to the other surface docs so the next change does not re-blur it.

**Files:**
- Create: `docs/SUITES_AND_RUNS.md`
- Modify: `CONTEXT.md` section 4.7.3

**Interfaces:** none.

- [ ] **Step 1: Write the doc**

Create `docs/SUITES_AND_RUNS.md` covering, in the register of `docs/DASHBOARD_UI.md`:

- Suite is the library: what should be tested. Editable, versioned, `active | draft | deprecated`.
- Run is the record: what happened once. `RunCase` deliberately copies `steps` and `expectedResult` at execution time so later edits to the case never rewrite history, the same way an invoice stores a price rather than a pointer to a catalogue.
- Only `source: manual` runs accept status edits. Everything else is evidence, enforced in `run-queries.service.ts` and reflected in `run-detail.tsx`.
- `RunCase.testCaseId` is the bridge between the two surfaces and the basis for traceability.
- A `draft` case with no steps is the expected output of CI discovery and the expected input of the AI copilot.

- [ ] **Step 2: Align the thesis**

In `CONTEXT.md` section 4.7.3, add a sentence recording that manual status capture applies to manually executed runs, and that results reported by external tools are read-only in the platform. Edit with a node script doing exact-string replacement with a match-count assertion — `CONTEXT.md` holds 9 inline base64 images and must never be edited with line-based tools.

- [ ] **Step 3: Commit**

```bash
git add docs/SUITES_AND_RUNS.md
git commit -m "docs: record the suite and run responsibility boundary"
```

`CONTEXT.md` is git-ignored, so it stays out of the commit.

---

## Verification

After the last task:

```bash
cd apps/api && npx jest --maxWorkers=2 && npx tsc --noEmit
cd ../web && npx vitest run --poolOptions.threads.maxThreads=2 && npx tsc --noEmit
```

Manual check, in order:

1. Open a run whose source is GitHub Actions. The shortcut bar is replaced by the read-only notice; pressing `P` changes nothing.
2. Open a case in that run that came from JUnit. No Steps block, no Expected result block, no "Staging" badge, and the discovery notice is visible.
3. Open a suite with zero cases. The run button is disabled and explains why.
4. Open the suites list. The three filter triggers read their labels, not `all` / `all` / `recent`.
5. Start a manual run from a suite that has cases. The suite select shows the suite name, not a cuid, and the shortcuts work.
