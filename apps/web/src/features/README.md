# Qably Web — Vertical Slices

Each folder under `features/` is a vertical slice. A slice owns its own
`components/`, `hooks/`, `lib/`, `test/`, and (where needed) `context/`.

## Slices

- `auth/` — login + register pages, form validation, mock auth hook
- `projects/` — project list, new project, project home, project context
- `suites/` — suite list with inline edit, suite detail with case cards
- `runs/` — run list, new run, run detail with keyboard shortcuts
- `ai-review/` — two-pane confirm/reject/skip for AI-generated cases
- `pipelines/` — pipeline list with status filter
- `reports/` — charts (Recharts, lazy-loaded)
- `settings/` — org, members, API keys, integrations

## Conventions

- Each component file has a colocated test file in `test/`.
- Tests use React 19 patterns: `await act(async () => { render(...) })`.
- Icons: `@phosphor-icons/react` ONLY. No lucide, no hand-rolled SVG.
- Colors: tokens only (no hardcoded hex/rgb/oklch in components).
- Typography: Geist Sans (body) + Geist Mono (numbers/code only).
- Status indicators: icon + label, color is supplementary.
- Honor `prefers-reduced-motion` in all motion.

## Cross-slice primitives

Live in `apps/web/src/components/` (NOT in `features/`):

- `ui/` — shadcn primitives (Input, Label, Tabs, Dialog, Select, Badge,
  Button, Tooltip, Separator). These are stateless and used across slices.
- `shell/` — AppShell, Sidebar, TopBar, Breadcrumbs. These are the
  authenticated app's chrome.

## Mock data layer

`apps/web/src/lib/mock-store.ts` is the in-memory pub-sub store seeded
from `lib/mock-data.ts`. `apps/web/src/lib/use-mock-store.ts` exposes
React 19 hooks via `useSyncExternalStore`. In Phase 2, the store is
replaced with real API calls; the hook shapes stay the same.

## New slice?

1. Create `apps/web/src/features/<slice>/`.
2. Add subfolders: `components/`, `hooks/`, `test/`, optionally `lib/`
   and `context/`.
3. Add a section to this README.
4. Add the slice to the route tree in `apps/web/src/app/(app)/`.
