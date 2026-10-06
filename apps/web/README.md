# Qably Web Console

The web application is the primary management interface for Qably. Built with Next.js 16 (App Router), React 19, and Tailwind CSS v4, it provides QA engineers and engineering leads with tools to monitor test suites, inspect CI execution runs, review AI-generated test cases, and configure integrations.

## Architecture and State Management

The frontend architecture decouples UI components from backend communication:

1. **HTTP Client (`src/lib/api-client.ts`):** Direct communication with `apps/api`. Every request automatically includes the active organization header (`x-organization-id`), the user's preferred locale (`accept-language`), and Better Auth session cookies.
2. **Server State Management:** TanStack Query handles server data fetching, query caching, background polling, and optimistic updates across all feature slices.
3. **Test fixtures and the mock store:** Feature data comes from the API. Tests seed the TanStack Query cache with the fixtures in `src/test/*-api-stub.ts` and `src/lib/mock-data.ts` through `src/lib/query-test-utils.tsx`. `src/lib/mock-store.ts` is an in-memory pub-sub store seeded from the same mock data; in production code only the linked-proposal lookup on the project repository page still reads it.
4. **Client State:** Lightweight local state is managed via Zustand stores: the active language (`src/lib/i18n/store.ts`) and the active organization (`src/stores/active-organization.store.ts`), both persisted in `localStorage`.

## Feature Slices

Code under `src/features/` is organized into modular domain boundaries. Routes live under `src/app/(app)`; the sidebar links to `/dashboard`, `/projects`, `/review-inbox`, `/notifications` and `/settings`, and, inside a project, to its repository, Aeris chat, test library (`suites`), runs, quality and API keys pages.

- `dashboard`: Organization overview at `/dashboard`: four KPI cards, an executed-cases comparison chart, a projects table sorted by pass rate, a case-priority donut, notification channel delivery, and a recent activity feed. `KpiStrip` is reused on the project quality page.
- `projects`: Project onboarding and settings, plus the per-project sections under `/projects/[id]`: `repository` (SCM connection, webhook setup, test file patterns), `suites` (the test library: a server-paginated list with search, tag and status filters, suite detail, inline case editing, and Aeris documentation requests), `quality` (pass-rate delta trend and daily outcome activity), and `api-keys` (key issuance and signing key rotation).
- `ai-review`: The Aeris project chat at `/projects/[id]/aeris`: conversation threads, case attachment, and sending generated cases to the review inbox. `/projects/[id]/ai-review` redirects there.
- `runs`: Per-project runs at `/projects/[id]/runs`, split into an Actions tab (CI runs grouped by job, with a CI run detail page) and a Manual tab (manual runs, created from a dialog), plus the run detail with per-case results.
- `review-inbox`: Triage queue for AI-proposed test cases at `/review-inbox`. Includes a cursor-paginated queue with search, project, status and duplicate filters, a proposal inspector with evidence and duplicate comparison, approve and reject decisions, and an explanation of approval conflicts.
- `integrations`: Repository connection components (provider presentation, repository picker, detected stack, SCM webhook setup) and the Slack and Discord notification webhook management shown in Settings. The `/integrations` route itself only points to Projects and Settings.
- `notifications`: In-app notification list at `/notifications`, the notifications menu, and the per-event channel preferences shown in Settings.
- `organizations`: Organization list and current organization, members, invitations and plan usage hooks, and the invitation acceptance view at `/invite/[token]`.
- `auth`: User login, account registration (email and GitHub), and session validation using Better Auth.
- `settings`: Settings tabs at `/settings`: plan and usage, members and invitations, notification preferences, notification webhooks, and language.

## Shared UI Integration

Presentational dashboard components are consumed from the `@qably/ui/dashboard` workspace package rather than being re-implemented locally:

- `ActivityEntryRow`: Recent-activity row for a commit or a standalone run.
- `ChannelStat`: Stacked number-and-unit stat for a notification channel row.
- `ChartDataTable`: Screen-reader table that mirrors a chart's series.
- `DeliveryBars`: Per-day sent and failed bars for a notification channel.
- `PassRateBar`: Single-row pass-rate bar.

The area, bar and pie charts are local to this app in `src/components/charts`, and the KPI card is `src/components/ui/kpi-stat-card.tsx`.

## Available Scripts

Commands can be run inside `apps/web` or from the monorepo root using `pnpm --filter @qably/web <command>`.

### Development

Start the Next.js development server:

```bash
pnpm run dev
```

### Production Build

Compile the Next.js application for production:

```bash
pnpm run build
```

Start the compiled production build locally:

```bash
pnpm run start
```

### Type Checking

Verify TypeScript types across all components, hooks, and routes:

```bash
pnpm run type-check
```

### Testing

Run unit and component tests with Vitest:

```bash
pnpm run test:run
```

Run tests in watch mode during development:

```bash
pnpm run test
```

`pnpm run test:ci` runs the same single pass as `test:run`. Both cap Vitest at two workers.

### Code Quality

Run ESLint to check for lint issues:

```bash
pnpm run lint
```

Apply ESLint auto-fixes:

```bash
pnpm run lint:fix
```
