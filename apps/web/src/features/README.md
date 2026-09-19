# Qably Web Vertical Slices

Each folder under `src/features/` is an isolated domain slice. A slice manages its own components, hooks, utilities, test files, and local context providers.

## Slices

- `auth`: Login, account registration, form validation, and Better Auth session hooks.
- `dashboard`: Organization analytics, pass-rate trends, KPI summary cards, traceability contribution calendar, and project status tables.
- `integrations`: SCM webhook setup guides and CI reporter configuration.
- `notifications`: Delivery settings and webhook URLs for email, Discord, and Slack channels.
- `organizations`: Organization switching, invitations, and member role management.
- `projects`: Project creation, settings, API key management, and test suite listings.
- `review-inbox`: Triage queue for AI-proposed test cases, candidate duplicate ranking, and case publishing.
- `runs`: CI test run viewer, status filters, JUnit ingestion results, and execution logs.
- `settings`: Organization details, profile preferences, and subscription plans.

## Conventions

- Each component file has a colocated test file in a `test/` subfolder.
- Tests follow React 19 testing patterns.
- Icons rely exclusively on `@phosphor-icons/react`. Lucide and bespoke SVGs are excluded.
- Colors rely strictly on CSS custom property tokens. No raw hex, rgb, or oklch strings in components.
- Typography uses Geist Sans for copy and Geist Mono for numerical metrics and code snippets.
- Status chips always display an icon paired with a text label for accessibility.
- Animations respect `prefers-reduced-motion`.

## Cross-Slice Primitives

Located in `apps/web/src/components/`:

- `ui/`: Customized shadcn/ui primitives (Input, Label, Tabs, Dialog, Select, Button).
- `shell/`: Application shell components including AppShell, Sidebar, TopBar, and Breadcrumbs.

## Data Layer

The application queries backend endpoints using the HTTP client in `src/lib/api-client.ts` orchestrated by TanStack Query. The in-memory store in `src/lib/mock-store.ts` provides a typed fallback for isolated testing and offline development.

## Creating a Slice

1. Create a directory at `apps/web/src/features/<slice>/`.
2. Add subdirectories: `components/`, `hooks/`, `test/`, and optionally `lib/` and `api/`.
3. Document the slice in this README.
4. Mount the slice components into the route tree under `apps/web/src/app/(app)/`.
