---
name: Qably
description: QA lifecycle management with AI-assisted test case generation
colors:
  bg: "oklch(0.978 0.002 85)"
  bg-surface: "oklch(1.000 0.000 0)"
  bg-surface-raised: "oklch(0.995 0.002 85)"
  bg-sidebar: "oklch(0.950 0.003 85)"
  bg-sidebar-hover: "oklch(0.920 0.004 85)"
  bg-sidebar-active: "oklch(0.995 0.001 85)"
  fg: "oklch(0.185 0.004 85)"
  fg-muted: "oklch(0.475 0.008 85)"
  fg-sidebar: "oklch(0.205 0.004 85)"
  fg-sidebar-muted: "oklch(0.465 0.008 85)"
  border: "oklch(0.890 0.004 85)"
  border-strong: "oklch(0.820 0.006 85)"
  border-sidebar: "oklch(0.865 0.005 85)"
  primary: "oklch(0.185 0.004 85)"
  primary-hover: "oklch(0.290 0.006 85)"
  primary-fg: "oklch(0.990 0.000 0)"
  surface-hover: "oklch(0.930 0.004 85)"
  accent-ai: "oklch(0.405 0.008 85)"
  accent-ai-bg: "oklch(0.940 0.003 85)"
  status-pass: "oklch(0.45 0.15 145)"
  status-pass-bg: "oklch(0.95 0.05 145)"
  status-fail: "oklch(0.45 0.20 25)"
  status-fail-bg: "oklch(0.96 0.05 25)"
  status-blocked: "oklch(0.55 0.18 50)"
  status-blocked-bg: "oklch(0.97 0.04 50)"
  status-skip: "oklch(0.55 0.00 0)"
  status-skip-bg: "oklch(0.94 0.00 0)"
  status-running: "oklch(0.50 0.18 240)"
  status-running-bg: "oklch(0.95 0.05 240)"
  status-warn: "oklch(0.53 0.15 80)"
  status-warn-bg: "oklch(0.97 0.05 80)"
  heatmap-l0: "oklch(0.930 0.004 85)"
  heatmap-l1: "oklch(0.850 0.090 145)"
  heatmap-l2: "oklch(0.700 0.150 145)"
  heatmap-l3: "oklch(0.560 0.180 145)"
  heatmap-l4: "oklch(0.440 0.200 145)"
  mesh-ink: "oklch(0.000 0.000 0)"
  mesh-graphite: "oklch(0.220 0.000 0)"
  mesh-ash: "oklch(0.380 0.000 0)"
typography:
  display:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem (sm: 1.875rem)"
    fontWeight: 600
    lineHeight: "tight"
    letterSpacing: "tight"
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "normal"
  label:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
spacing:
  page-shell-x: "1.25rem (sm: 1.75rem, lg: 2.25rem)"
  page-shell-y: "1.5rem (lg: 1.5rem)"
  page-shell-gap: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "lg"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "lg"
  button-ghost:
    textColor: "{colors.fg}"
    rounded: "lg"
  badge-pass:
    backgroundColor: "{colors.status-pass-bg}"
    textColor: "{colors.status-pass}"
    rounded: "sm"
  badge-fail:
    backgroundColor: "{colors.status-fail-bg}"
    textColor: "{colors.status-fail}"
    rounded: "sm"
  input:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.fg}"
    rounded: "lg"
    height: "2.5rem"
---

# Design System: Qably

## 1. Overview

**Creative North Star: "The Instrument Panel"**

Qably reads like an instrument panel for a QA discipline, not a marketing surface for one. Every number, status, and generated field has a needle pointing back to where it came from: a PR, a commit, a file, a run. The palette is a single near-neutral ink-on-paper scale with color spent only on semantic status, never on brand decoration. Density is welcomed where the task needs it (tables, runs, case lists), and restraint governs everything else: one accent-free surface, one type family, one shadow vocabulary used sparingly.

This system explicitly rejects the SaaS-dashboard cliché of a rediscovered TestRail with a chatbot bolted on, gradient hero metrics, and uppercase tracked eyebrows. It also rejects color-only status signaling: every status pairs an icon with a text label, because the interface must communicate the same information to a QA lead skimming a dashboard and to a screen reader user auditing a run.

Motion is functional, not decorative: a single page-enter fade-rise on mount, nothing more, fully disabled under `prefers-reduced-motion`.

**Key Characteristics:**
- Ink-on-paper neutral scale (near-black text, near-white surfaces), zero saturated brand color.
- Status conveyed by icon + label + color together, never color alone.
- Geist Sans everywhere in the UI; Geist Mono reserved strictly for technical data (raw identifiers, file paths, code, durations).
- Flat surfaces at rest; shadows are a near-invisible 1px card resting shadow and a slightly stronger popover shadow for layered content (dialogs, menus, selects).
- No dark mode implemented.

## 2. Colors

The palette is a single warm-neutral ink/paper ramp (hue 85, chroma near zero) plus a fixed semantic status vocabulary. There is no brand accent color; the darkest neutral (`--primary`) doubles as the sole "brand" color, used for primary actions and focus rings.

### Primary
- **Ink** (`--primary`, `oklch(0.185 0.004 85)`): primary buttons, focus rings, active sidebar state, links. This is also the default text color (`--fg`), so "brand" and "text" share one value by design.
- **Ink Hover** (`--primary-hover`, `oklch(0.290 0.006 85)`): hover state for primary buttons only.

### Neutral
- **Paper** (`--bg`, `oklch(0.978 0.002 85)`): page canvas background.
- **Surface** (`--bg-surface`, `oklch(1.000 0.000 0)`): cards, panels, inputs, dialogs — pure white against the slightly warm paper canvas.
- **Surface Raised** (`--bg-surface-raised`, `oklch(0.995 0.002 85)`): KPI cards and elements that sit one step above surface.
- **Sidebar Paper** (`--bg-sidebar`, `oklch(0.950 0.003 85)`) / **Sidebar Hover** (`--bg-sidebar-hover`) / **Sidebar Active** (`--bg-sidebar-active`): the sidebar's own neutral layer, distinct from content surfaces.
- **Text** (`--fg`, `oklch(0.185 0.004 85)`): default body and heading text.
- **Muted Text** (`--fg-muted`, `oklch(0.475 0.008 85)`): secondary text, descriptions, timestamps.
- **Border** (`--border`, `oklch(0.890 0.004 85)`) / **Border Strong** (`--border-strong`, `oklch(0.820 0.006 85)`): default dividers and hover/focus borders.
- **Hover Surface** (`--surface-hover`, `oklch(0.930 0.004 85)`): background for ghost/outline interactive hover states. Distinct from muted text; this is a background token, never a text color.

### Status (semantic only, never decorative)
- **Pass** (`--status-pass` / `--status-pass-bg`, green, hue 145): passed tests, confirmed reviews, active cases.
- **Fail** (`--status-fail` / `--status-fail-bg`, red, hue 25): failed tests, rejected reviews, destructive actions.
- **Blocked** (`--status-blocked` / `--status-blocked-bg`, orange, hue 50): blocked test results.
- **Skip** (`--status-skip` / `--status-skip-bg`, achromatic): skipped tests, cancelled runs, deprecated cases.
- **Running** (`--status-running` / `--status-running-bg`, blue, hue 240): in-progress runs, pending review states shown as active.
- **Warn** (`--status-warn` / `--status-warn-bg`, amber, hue 80): draft cases, needs-attention states.

### AI accent
- **AI Ink** (`--accent-ai` / `--accent-ai-bg`, hue 85, near-neutral): reserved exclusively for markers on AI-generated content. It is deliberately close to the neutral ramp rather than a saturated "AI purple," so generated content is flagged without visually competing with status colors.

### Decorative-only
- **Auth Mesh** (`--mesh-ink` / `--mesh-graphite` / `--mesh-ash`): pure grayscale values used only by the authentication page's decorative shader panel. Never used for content or status; the shader's color-dodge grain doubles each channel; these stay dark enough that the doubled result never reaches white.

### Named Rules
**The No-Color-Alone Rule.** Every semantic status pairs its color with a Phosphor icon and a translated text label (see `status-presentation.tsx`). A status token's color value is never the sole carrier of meaning.

**The One Ink Rule.** There is exactly one non-neutral, non-status color role (`--primary`), and it does the double duty of text, brand, and focus. No second accent competes with it.

## 3. Typography

**Body & Display Font:** Geist Sans (loaded via `next/font/google`, with `ui-sans-serif, system-ui, sans-serif` fallback)
**Technical/Code Font:** Geist Mono (loaded via `next/font/google`), reserved for technical data only: raw automation identifiers, file paths, commit SHAs, durations, code snippets and diffs.

**Character:** One sans family carries every UI role, from page titles to table cells, per the product register (density and consistency over display/body contrast). Mono never appears in headings, labels, or prose; it appears only where the value itself is a technical artifact.

### Hierarchy
- **Page Title** (`font-semibold`, `text-2xl sm:text-3xl`, `tracking-tight`): the single `PageHeader` title per route.
- **Section/Card Title** (`font-semibold`, `text-base`, `tracking-tight`): `CardTitle`, `InspectorPanel` title.
- **Body** (`font-normal` to `font-medium`, `text-sm`): default UI text, descriptions, list rows. `text-wrap-pretty` on longer descriptive copy, `text-wrap-balance` on headings.
- **Label** (`font-medium` to `font-semibold`, `text-xs`): form labels, status chip text, badges, KPI labels.
- **Technical/Mono** (`font-mono`, `text-xs`): raw automation names, file paths, diff lines, IDs. Always paired with a humanized label as the primary text; mono is secondary.

Sizing uses Tailwind's fixed rem scale directly (`text-xs` / `text-sm` / `text-base` / `text-2xl` / `text-3xl`), not a fluid `clamp()` scale — consistent with product UI viewed at fixed DPI rather than a marketing surface.

### Named Rules
**The Mono-Is-Evidence Rule.** Monospace type never carries a heading, label, or narrative sentence. It appears only next to a humanized equivalent, marking "this is the raw technical value," never as a stylistic choice.

## 4. Elevation

The system is flat by default. Resting surfaces (cards, KPI cards, the AI diff panel) carry a barely-visible 1px shadow, tinted to the ink hue rather than pure black. Layered, floating surfaces (dialogs, select popups, menus, tooltips) use a stronger two-layer shadow. There is no tonal elevation ramp beyond these two roles.

### Shadow Vocabulary
- **Card** (`--shadow-card`: `0 1px 1px 0 oklch(0.185 0.004 85 / 0.025)`): resting cards, KPI cards, the AI diff container. Nearly imperceptible; communicates "this is a discrete surface," not depth.
- **Pop** (`--shadow-pop`: `0 4px 12px -2px oklch(0.12 0 0 / 0.08), 0 2px 4px -2px oklch(0.12 0 0 / 0.04)`): dialogs, select/menu popovers, sheets. The only shadow strong enough to read as "floating above the page."

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only to mark a discrete card boundary (`shadow-card`) or an overlay that floats above the page (`shadow-pop`). No shadow scale beyond these two steps exists; do not invent a third.

## 5. Components

### Buttons
- **Shape:** `rounded-lg` at default/sm/lg sizes; small icon-only sizes (`xs`) clamp to `min(var(--radius-md), 10-12px)`. Border-radius comes from Tailwind's stock theme scale, not a project-defined token.
- **Primary:** ink background (`--primary`), `--primary-fg` text, `hover:bg-primary/80`.
- **Outline:** transparent/background fill, `--border` stroke, `hover:bg-surface-hover`.
- **Secondary:** muted fill with a 5%-ink-mixed hover.
- **Ghost:** no border or fill at rest, `hover:bg-surface-hover`.
- **Destructive:** `--status-fail`-tinted background at 10% opacity, deepening on hover. Used for irreversible actions (see `ConfirmDialog`).
- **Link:** primary-colored text with underline on hover only.
- **Sizes:** `xs` / `sm` / `default` / `lg`, plus square `icon-xs` / `icon-sm` / `icon` / `icon-lg` variants.
- **Feedback:** all variants translate `1px` down on `:active`; focus shows a 2px primary ring at 25% opacity with 1px offset.

### Badges & Status Chips
- **Badge:** `rounded` (4px-class), bordered, tonal background per variant (`default`, `pass`, `fail`, `running`, `warn`, `skip`, `outline`). Used for static labels.
- **Status Chip:** the canonical status renderer (`status-chip.tsx` + `status-presentation.tsx`). Always icon (Phosphor, 12px, `weight="fill"`) plus translated text label plus a tone-derived background/text pair. Three scoped presentation registries — execution status (pass/fail/skip/blocked/running/pending/needs-attention/never-run), review status (pending/confirmed/rejected), and case lifecycle (active/draft/deprecated) — so no module invents a local status color.

### Cards / Containers
- **Corner Style:** `rounded-xl`.
- **Background:** `--card` (maps to `--bg-surface`).
- **Shadow Strategy:** `shadow-card` at rest; KPI cards add `hover:shadow-xs` and a subtle border-strong shift on hover/focus.
- **Border:** 1px `--border`.
- **Internal Padding:** header/content/footer each use `p-5` (content drops top padding against the header).

### Inputs / Fields
- **Style:** `--border` stroke, `--bg-surface` fill, `rounded-lg`, `shadow-xs`, `h-10` for text inputs, `h-9` for selects.
- **Focus:** border shifts to `--primary` plus a 1px primary ring at 20% opacity (no thick double outline; native `outline` is suppressed on all form controls in favor of this ring).
- **Error / Disabled:** `aria-invalid` swaps the border/ring to `--status-fail`-derived tokens; `disabled` drops opacity to 50% and adds a faint hover-tint background.
- **Field composition:** `Field` / `FieldLabel` / `FieldContent` / `FieldDescription` / `FieldError` compose label, helper text, and inline error under one `role="group"` wrapper, with vertical, horizontal, or responsive orientation.

### Navigation (Sidebar)
- **Style:** collapsible sidebar with its own neutral layer (`--bg-sidebar` family, distinct border token `--border-sidebar`), collapses to an icon rail or an off-canvas sheet on mobile (`useIsMobile`), persists open/collapsed state in a cookie, and exposes a `Cmd/Ctrl+B` keyboard shortcut.

### Dialogs, Sheets, Menus, Tooltips, Tabs
- **Dialog:** centered, `shadow-pop`, `rounded-lg`, backdrop blur over a 50%-black overlay, built-in close button.
- **Sheet:** off-canvas panel from any edge (`top` / `right` / `bottom` / `left`), lighter overlay (10% black, background blur) than the centered dialog.
- **ConfirmDialog:** the single shared "are you sure?" pattern for destructive actions across the product; its confirm button always uses the `destructive` button variant rather than inventing a new warning color.
- **Menu:** popover list, `shadow-pop`, highlighted item uses `primary/10` background with primary text.
- **Tooltip:** dark (`--foreground`-background) inverted popover with an arrow, zero default delay.
- **Tabs:** underline-style tab list (`border-b`), selected tab gets a 2px primary underline.

### List & Table Primitives
- **EntityList:** a plain `<ul>` with `divide-y` row separators; the shared list primitive instead of ad hoc bordered rows.
- **DataTable:** horizontally scrollable wrapper around a plain `<table>` with a screen-reader-only `<caption>`; never forces horizontal scroll to complete a primary decision per the roadmap's responsive rule, so dense tables must expose priority columns plus an inspector rather than relying on scroll alone.
- **InspectorPanel:** a bordered, titled `<aside>` used as the secondary detail pane in split layouts.
- **ResizableSplit:** the two-pane layout primitive (list + inspector). Drag handle is a 1px line with a 12px invisible hit zone, fully keyboard-operable (arrow keys, Home/End, Enter/Space to reset), persists width to `localStorage` per `storageKey`.

### KPI Card
- Three-tier vertical layout: label + icon, then a large tabular-nums metric, then a trend or status footer. Whole card is a tactile click target when `href` is provided (`active:scale-[0.985]`).

### Provenance & Traceability
- **EvidenceList**, **ProvenanceSummary**, **TraceabilityTrail**: dedicated components rendering the source PR/commit/file/run behind any generated content, each with its own labeled section and icon. These exist specifically so provenance is never buried in prose.

### AI Diff
- A proposed AI edit awaiting a human accept/reject decision. Added/removed lines use `--status-pass` / `--status-fail` tints; accepting or rejecting flashes a brief background tint and collapses rejected lines to zero height. This component defines its own inline OKLCH flash tints (`oklch(72% 0.17 150 / 0.14)`, `oklch(63% 0.21 25 / 0.12)`) rather than referencing the `--status-pass`/`--status-fail` tokens directly — a deviation from the tokens-only rule worth reconciling if this component is touched again.

## 6. Do's and Don'ts

### Do:
- **Do** use `--status-*` tokens for every pass/fail/blocked/skip/running/warn state, always paired with an icon and a text label, never color alone.
- **Do** keep Geist Mono scoped to technical data (raw names, paths, SHAs, durations, code); everything else is Geist Sans.
- **Do** use the two-shadow vocabulary only: `shadow-card` for resting surfaces, `shadow-pop` for floating/overlay surfaces.
- **Do** route every AI-generated field through `EvidenceList` / `ProvenanceSummary` / `TraceabilityTrail` so provenance stays visible and one interaction away.
- **Do** build the page shell as `w-full space-y-6 px-5 py-6 sm:px-7 lg:px-9 lg:py-6 animate-page-enter`, matching every existing route.
- **Do** respect `prefers-reduced-motion`; the codebase already disables all animation/transition duration globally under that media query.

### Don't:
- **Don't** introduce a new hex, rgb, or ad hoc oklch color in a component. All color goes through the CSS custom properties in `globals.css`.
- **Don't** recreate the TestRail/Qase-with-a-chatbot pattern: no generic AI chat surface as a primary navigation path.
- **Don't** publish an AI-generated case, suite, or field without an explicit human review action.
- **Don't** signal status with color alone; every status needs its icon and label.
- **Don't** force horizontal scroll on a dense table to complete a primary review decision; expose priority columns and use the inspector pattern instead.
- **Don't** invent a third shadow depth beyond `shadow-card` and `shadow-pop`.
- **Don't** add dark mode styling; none exists in the current system (`:root` defines a single light palette with no `prefers-color-scheme` or `[data-theme]` overrides).
- **Don't** hardcode a border radius; use Tailwind's stock scale (`rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`) as the components already do. There is no custom `--radius` token in this project.
