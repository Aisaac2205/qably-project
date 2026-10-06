# Qably Landing and Documentation

The landing application is the public-facing marketing website and interactive technical documentation portal for Qably. Built with Astro 7, React 19 islands, and Tailwind CSS v4, it provides product walkthroughs, live visual component previews, and API integration guides.

## Features

- **Bilingual Content Routing:** Spanish serves as the primary locale at `/`, while English pages are routed under `/en/`. Dictionaries and navigation labels are managed in `src/features/i18n/`.
- **Interactive Component Previews:** React 19 islands embed product interfaces directly into marketing sections:
  - `DashboardWindowFrame`: Desktop browser-window replica of the product dashboard (KPI strip, executed-cases chart, projects table, case-priority donut, notification channels, recent activity) fed by mock data, with a 7, 30 and 90-day period selector.
  - `MobileDashboardIphone`: Vector iPhone 16 Pro mockup rendering the same dashboard preview at phone width.
  - `PricingSection`: Three-tier pricing comparison built from `src/features/pricing/data/tiers.ts`. A test checks the tiers against `PLAN_LIMITS` in `@qably/types`.
- **Interactive Documentation Engine:** Available at `/docs` and `/en/docs`, featuring:
  - Topic navigation across setup steps, CI integration, SCM webhooks, and API references.
  - Code blocks with syntax highlighting and instant clipboard copying.
  - Multi-tab code snippets displaying reporting commands across languages and test frameworks.
- **Compliance and Legal Pages:** Dedicated layouts for terms of service, privacy policies, and security posture.

## Project Structure

```text
apps/landing/
├── src/
│   ├── components/
│   │   ├── charts/           # Vendored chart primitives used by the dashboard preview
│   │   └── ui/               # Reusable visual shells and vector device mockups
│   ├── features/
│   │   ├── dashboard-preview/ # Dashboard window frame, preview cards, and mock data
│   │   ├── documentation/     # Docs reader, syntax highlighting, and content dictionaries
│   │   ├── features-grid/     # Grid highlighting platform capabilities
│   │   ├── i18n/              # Translation dictionaries for marketing copy
│   │   ├── integrations/      # Marquee of language, framework, and tooling logos
│   │   ├── mobile-dashboard/  # Mobile preview components
│   │   ├── navigation/        # Header, footer, and call-to-action banners
│   │   └── pricing/           # Tier comparison and plan selection cards
│   ├── layouts/               # Base HTML templates and font definitions
│   ├── lib/                   # Public URL helpers and the dashboard preview translation store
│   ├── pages/                 # Astro file-based routes (root and /en/ variants)
│   └── styles/                # Global Tailwind CSS custom properties
└── public/                    # Static assets, logos, technology icons, favicons, and the OpenGraph image
```

## Environment

The build reads three public variables and fails when one is missing. `.env.example` lists only `PUBLIC_WEB_URL`.

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Origin of this site. Sets the Astro `site`, which feeds the canonical and language alternate links. |
| `PUBLIC_WEB_URL` | Origin of `apps/web`. The sign-in and sign-up links point to its `/login` page. |
| `PUBLIC_API_URL` | Origin of the Qably API, inserted into the example requests on the documentation pages. |

## Available Scripts

Scripts can be executed within this directory or from the monorepo root using `pnpm --filter @qably/landing <command>`.

### Development

Start the local Astro development server on port 4321:

```bash
pnpm run dev
```

### Production Build

Compile the static site and client-side JavaScript bundles to `dist/`:

```bash
pnpm run build
```

Preview the production build locally before deployment (`pnpm run start` runs the same command):

```bash
pnpm run preview
```

### Type Checking

Verify Astro components and TypeScript types:

```bash
pnpm run type-check
```

### Testing

Run unit and integration tests using Vitest:

```bash
pnpm run test:run
```
