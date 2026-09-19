# Qably

Qably is a QA management platform that integrates automated test suites, execution runs, CI pipeline ingestion, and test case documentation. When test files change or test runs complete, the platform extracts structured test cases using the Google Gemini API and queues them for human confirmation. The system manages the full quality lifecycle across projects, suites, manual runs, CI reporting, and analytics.

## Monorepo Layout

The repository is managed as a pnpm workspace orchestrated by Turborepo.

| Path | Stack | Description |
|---|---|---|
| `apps/web` | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, Zustand, Better Auth client | Primary web console for test suites, execution runs, review inbox, traceability calendars, and project settings. Communicates with `apps/api` via typed contracts and includes an in-memory mock store fallback. |
| `apps/api` | NestJS 11, PostgreSQL, Prisma ORM, Redis, BullMQ, Better Auth, Google Gemini (`@google/genai`), Resend | Core transactional backend handling organizations, projects, test run ingestion (JSON and JUnit XML), async AI test case extraction, and webhook integrations. |
| `apps/landing` | Astro 7, React 19 islands, Tailwind v4, Motion | Public marketing site and interactive technical documentation reader supporting Spanish (`/`) and English (`/en/`). |
| `packages/types` | TypeScript | Shared domain models, status definitions, API request schemas, and entity contracts (`@qably/types`). |
| `packages/ui` | React 19, Tailwind v4, Recharts | Shared dashboard analytics primitives including KPI cards, trend charts, status chips, and sparklines (`@qably/ui`). |
| `packages/i18n` | TypeScript | Centralized localization dictionaries (`en.json`, `es.json`) and RFC 4647/7231 locale negotiation helpers (`@qably/i18n`). |
| `packages/test-naming` | TypeScript | Shared utilities for sanitizing, formatting, and humanizing test and suite identifiers (`@qably/test-naming`). |
| `packages/config` | TypeScript | Shared TypeScript configuration (`tsconfig.base.json`) used across the workspace (`@qably/config`). |

## Architecture Overview

Qably isolates data ingestion into two independent channels:

1. **Test Run Ingestion:** CI pipelines send execution results to `POST /runs/ingest` or `POST /runs/ingest/junit` using a project API key (`Authorization: Bearer <key>`). The backend updates suite pass rates, stores failure logs, and computes health metrics.
2. **Repository Changes:** Source code providers send push events to `POST /webhooks/scm/:provider` with HMAC signatures. The backend enqueues jobs in Redis via BullMQ, loads test file diffs, and prompts the Google Gemini API (`gemini-3.1-flash-lite`) to extract structured test proposals into the review inbox.

The frontend (`apps/web`) communicates with `apps/api` through a centralized client that automatically attaches the current organization identifier (`x-organization-id`) and user session headers. When developing without a backend instance, the web application can run against a typed mock store.

## Design System

The product interface enforces strict design constraints documented in `CLAUDE.md`:

- **Tokens Only:** All styling relies on CSS custom properties. Component files must not declare hardcoded hex, rgb, or oklch values.
- **Typography:** Geist Sans for general interface typography and Geist Mono for code snippets and tabular metrics.
- **Component Primitives:** Customized shadcn/ui components paired with `@phosphor-icons/react`. Third-party icon sets like Lucide are excluded.
- **Accessibility:** Status indicators always pair distinct labels with icons so color is never the single differentiator.

## Prerequisites

- Node.js >= 22.12.0
- pnpm >= 10.0.0 (version 10.33.0 is configured in `package.json`)
- Docker (required to run PostgreSQL and Redis locally for `apps/api`)

## Getting Started

Install workspace dependencies from the root directory:

```bash
pnpm install
```

Start all applications concurrently in development mode:

```bash
pnpm run dev
```

Target a single application with the `--filter` flag:

```bash
# Start the web console
pnpm --filter @qably/web dev

# Start the NestJS API
pnpm --filter @qably/api start:dev

# Start the landing and documentation site
pnpm --filter @qably/landing dev
```

## Workspace Commands

The root `package.json` provides scripts that execute across all packages via Turborepo:

- `pnpm run build` runs production builds for every app and package.
- `pnpm run lint` executes ESLint across the codebase.
- `pnpm run type-check` verifies TypeScript types across all projects.

For service-specific testing and database operations, consult the README inside each application folder:

- [`apps/api/README.md`](file:///c:/Users/Asus/Projects/qably/apps/api/README.md) for database migrations, queue debugging, and backend test runners.
- [`apps/web/README.md`](file:///c:/Users/Asus/Projects/qably/apps/web/README.md) for frontend component testing and state management architecture.
- [`apps/landing/README.md`](file:///c:/Users/Asus/Projects/qably/apps/landing/README.md) for public marketing routes, docs content, and preview islands.
