# Qably — Design Rules

## UI/UX Skills (mandatory)

Skill sets are scoped by surface. Load the set for the app you are editing, before writing code. Loading the wrong set is worse than loading none: a marketing skill applied to the dashboard produces hero typography in a data table.

### apps/web — product surface

Dashboard, admin, settings, data tables, authenticated flows.

- `.claude/skills/impeccable/SKILL.md` — register is `reference/product.md`
- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/emil-design-eng/SKILL.md`

Never load `design-taste-frontend` here. Its Section 13 excludes dashboards, dense product UI and data tables by its own declaration, and its typography defaults target marketing heroes.

### apps/landing — marketing surface

Public pages, pricing, documentation, hero and dashboard previews.

- `.claude/skills/design-taste-frontend/SKILL.md`
- `.claude/skills/impeccable/SKILL.md` — register is `reference/brand.md`
- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/seo/SKILL.md`

### Excluded from both sets

- `frontend-design` — prescribes distinctive display-font pairing, custom cursors, grain overlays and deliberate per-project aesthetic variation. All four contradict the locked font stack and token system below, and custom cursors are explicitly banned by `design-taste-frontend` Section 9.A.
- `shadcn` — documents `@json-render/shadcn`, which this repo does not depend on.

### Precedence when skills disagree

1. This file wins over every skill.
2. `accessibility` wins on contrast, focus, target size and keyboard behaviour.
3. `impeccable` wins on typography, spacing and radius.
4. The surface-specific skill wins on layout and composition.
5. Otherwise the more restrictive rule wins.

Recorded resolution: `design-taste-frontend` Section 4.1 defaults display headings to `tracking-tighter` (-0.05em); `impeccable` sets a letter-spacing floor of -0.04em. The floor wins. Do not go below `tracking-tight` (-0.025em) on Qably display type.

## Color — Tokens only

All colors via CSS custom properties. Never hardcoded hex, rgb, or oklch in components.

```tsx
// Never
className="bg-[#1E1B4B]"
style={{ color: '#44190D' }}

// Always
className="bg-sidebar"
style={{ color: 'var(--primary)' }}
```

Each surface owns its own token file, and they are separate systems:

- `apps/web/src/app/globals.css` — light theme, OKLCH.
- `apps/landing/src/styles/global.css` — dark theme, hex and rgba.

Token names collide across the two files with opposite values: `--primary` is near-black in `apps/web` and `#ffffff` in `apps/landing`. Never copy a token block, a colour value or a component's colour classes from one surface to the other. Confirm which file governs before editing colour.

## Typography

No Inter. No monospace as body font.
Stack: Geist Sans (body) + Geist Mono (code snippets and numeric data only).
Never hardcode font families, weights, or sizes in components — use Tailwind scale.

## Components

- shadcn/ui as base, always adapted to project tokens — never in default state
- Icons: `@phosphor-icons/react` — no lucide, no hand-rolled SVG paths
- Tokens first → Tailwind utilities second → arbitrary values never

## Commit Discipline

- Every complete, validated change must end with its own conventional commit before starting another change.
- Keep each commit atomic and reviewable: include only the files belonging to that change and never absorb unrelated worktree changes.
- Do not accumulate completed changes in the working tree. If a change cannot be committed, document the blocker before continuing.
