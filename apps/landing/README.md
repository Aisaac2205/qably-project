# Qably Landing and Documentation

The landing application is the public-facing marketing website and interactive technical documentation portal for Qably. Built with Astro 7, React 19 islands, and Tailwind CSS v4, it provides product walkthroughs, live visual component previews, and API integration guides.

## Features

- **Bilingual Content Routing:** Spanish serves as the primary locale at `/`, while English pages are routed under `/en/`. Dictionaries and navigation labels are managed in `src/features/i18n/`.
- **Interactive Component Previews:** React 19 islands embed product interfaces directly into marketing sections:
  - `DashboardWindowFrame`: Desktop browser-window replica of the product dashboard (KPI strip, executed-cases chart, projects table, case-priority donut, notification channels, recent activity) fed by mock data, with a 7, 30 and 90-day period selector.
  - `MobileDashboardIphone`: Vector iPhone 16 Pro mockup rendering the same dashboard preview at phone width.
  - `PricingSection`: Three-tier pricing comparison built from `src/features/pricing/data/tiers.ts`. A test checks the tiers against `PLAN_LIMITS` in `@qably/types`.
- **Interactive Documentation Engine:** One page per topic, served at `/docs/<slug>` and `/en/docs/<slug>` (the overview is the docs root, `/docs` and `/en/docs`), featuring:
  - A grouped left sidebar, a right "On this page" table of contents that follows the reader, previous and next links, and a collapsible menu below the `lg` breakpoint.
  - Topic pages for the setup steps, CI integration, SCM webhooks, and API references.
  - Code blocks with syntax highlighting and instant clipboard copying.
  - Multi-tab code snippets displaying reporting commands across languages and test frameworks.
- **Compliance and Legal Pages:** Dedicated layouts for terms of service, privacy policies, and security posture.

## Documentation Pages

The docs content is a page model per locale: `src/features/documentation/content/{es,en}.ts` each export a `DocContent` with `pages` (slug, nav label, title, description, sections) and `navGroups` (the sidebar groups, in reading order). Slugs are stable English slugs shared by both locales, and each section keeps its `id` as the anchor of its `h2`.

- To add a page, add a `DocPage` to `pages` in both locales and list its slug in one `navGroups` entry. `src/pages/docs/[...slug].astro` and `src/pages/en/docs/[...slug].astro` build one route per page through `getStaticPaths`; `content.test.ts` fails when the locales or the nav disagree.
- A page whose only section repeats the page title shows the title once, as the `h1`. A page shows the right table of contents when it has at least two entries (its sections plus its `subheading` blocks, which get stable anchors from their text).
- Links that predate the split (`/docs#step-4-report-ci`) are still alive: the overview page maps every old section id to its new page in `lib/legacy-targets.ts` and redirects in the browser, because a server never sees a fragment. Keep that map when a page is renamed or removed.
- `lib/docs-links.test.ts` checks that every `/docs...` link written in the landing source resolves to a page and an anchor of the page model.

### Inline markup in docs text

Paragraphs, list items, table cells, callouts, FAQ questions and answers and subheadings accept a small markup, defined in one place (`lib/inline.ts`) and rendered by `components/Inline.astro`. It is parsed into nodes and built into elements, never injected as HTML, so `<`, `&` and quotes in the content are always plain text.

| Write | Get |
|---|---|
| `**bold**` | strong text; may hold `code` and links |
| `` `code` `` | inline code, verbatim (nothing inside is parsed) |
| `[label](/docs/<slug>#<anchor>)` | a link to a docs page or one of its anchors, localized to the page's locale; `/docs` is the overview |
| `[label](https://host.tld/path)` | an external https link (`rel="noopener noreferrer"`) |

A marker with no partner stays literal, a link with an empty label stays literal, and a target outside the two forms above (`javascript:`, `data:`, `http:`, a relative path, a URL with credentials) is rejected: only its label is shown. `lib/docs-links.test.ts` fails when a link written in markup points to a page or an anchor that does not exist, or has a rejected target. Code blocks, code-group labels, page titles and descriptions are plain text and never parsed. Subheading anchors and table-of-contents labels come from the words, so adding markup to a heading never moves its anchor.

### Docs UI language

The reader is dark, monochrome and quiet: Geist, tokens from `src/styles/global.css` only, no hue anywhere in `components/` (`components/docs-components.test.ts` fails on a status or palette colour, a colour literal, an arbitrary Tailwind value, a string injected as HTML or a random id).

- **Hierarchy:** the lead paragraph is larger and muted, `h2` has 3rem above and 1rem below, body text is 1rem with 1.75 leading in `fg-muted`, and headings and `**bold**` words use `fg`.
- **Callouts** (`components/Callout.astro`): a bordered surface with a Phosphor icon and a bold lead-in label from `content.labels` (`calloutInfo`, `calloutWarning`: "Note", "Important"). Tone is carried by icon, label and a stronger hairline for a warning, never by colour.
- **Tabs** (`components/CodeGroup.astro`): an underlined strip that scrolls inside itself; ids come from the section id and the block position, so two builds emit the same HTML.
- **Rails:** the sizes and offsets are tokens added under `:root` and `@theme inline` in `global.css`: `--docs-sidebar-width`, `--docs-toc-width`, `--docs-article-width` (classes `w-docs-sidebar`, `w-docs-toc`, `max-w-docs-article`), `--docs-scroll-offset` (`top-docs-offset`, `scroll-mt-docs-offset`, also the offset the scroll spy reads) and `max-h-docs-rail`.
- **Diagrams** (`components/Diagram.astro`, `lib/diagram.ts`): a `diagram` block draws a linear flow from data, in the palette of the page, with an ordered text alternative.

```ts
{
  type: 'diagram',
  title: 'From CI to Qably',            // plain text, names the figure
  description: 'The test report ...',   // plain text, read in place of the drawing
  caption: 'Qably never runs ...',      // optional, inline markup allowed
  groups: [                             // optional lanes, in flow order
    { id: 'ci', label: 'Your CI', tone: 'external' },
    { id: 'qably', label: 'Qably', tone: 'qably' },
  ],
  nodes: [                              // in flow order; a lane's nodes must be consecutive
    { id: 'runner', label: 'Test runner', group: 'ci' },
    { id: 'report', label: 'Report', detail: 'A `junit.xml` file', group: 'ci' },
    { id: 'ingest', label: 'Ingest API', group: 'qably' },
  ],
  edges: [                              // optional: only names the connector between consecutive nodes
    { from: 'report', to: 'ingest', label: 'uploads' },
  ],
}
```

The flow is linear: an edge must join a node to the one that follows it (a back edge, a skipped step, an unknown id or a split lane is rejected by `validateDiagram`, and `content.test.ts` runs it on every diagram). Two parallel pipelines are two diagrams. Nodes run in a row from `md` and in a column on phones; lanes stack.

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
