# Qably Web Console

The web application is the primary management interface for Qably. Built with Next.js 16 (App Router), React 19, and Tailwind CSS v4, it provides QA engineers and engineering leads with tools to monitor test suites, inspect CI execution runs, review AI-generated test cases, and configure integrations.

## Architecture and State Management

The frontend architecture decouples UI components from backend communication and provides dual data paths:

1. **HTTP Client (`src/lib/api-client.ts`):** Direct communication with `apps/api`. Every request automatically includes the active organization header (`x-organization-id`), the user's preferred locale (`accept-language`), and Better Auth session cookies.
2. **Server State Management:** TanStack Query handles server data fetching, query caching, background polling, and optimistic updates across all feature slices.
3. **Mock Store Fallback (`src/lib/mock-store.ts`):** An in-memory pub-sub store with typed entities matching backend contracts. It allows full frontend development and automated testing without spinning up PostgreSQL or the NestJS API.
4. **Client State:** Lightweight local state such as UI preferences and active language is managed via Zustand stores (`src/lib/i18n/store.ts`).

## Feature Slices

Code under `src/features/` is organized into modular domain boundaries:

- `dashboard`: Organization analytics including four KPI metrics, pass-rate trend charts, project status table with attention-level sorting, recent activity feed, and a GitHub-style traceability heatmap.
- `projects`: Project onboarding, repository linking, project API key generation, and test suite listings.
- `runs`: Test run execution viewer with status filters, failure logs, execution timing, and JUnit ingestion results.
- `review-inbox`: Triage queue for AI-proposed test cases. Includes candidate duplicate ranking, automated file path resolution, and one-click case publishing.
- `integrations`: Guides and status indicators for source control webhooks and CI/CD reporting pipelines.
- `notifications`: Alert channel management for email, Discord, and Slack notifications on test failures or regressions.
- `auth`: User login, account registration, and session validation using Better Auth.
- `settings`: Organization members, roles, and profile configuration.

## Shared UI Integration

Presentational analytics components are consumed directly from the `@qably/ui` workspace package rather than being re-implemented locally:

- `KpiCard`: Number summary card with variance indicators.
- `TrendChart`: Pass-rate historical line and area charts.
- `Sparkline`: Inline sparkline indicators for compact metric rows.
- `StatusChip`: Accessible status badges pairing icons with descriptive labels.
- `StatusDonut`: Visual ring breakdown of test execution verdicts.

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

### Code Quality

Run ESLint to check for lint issues:

```bash
pnpm run lint
```
