# Qably — Design Rules

## UI/UX Skills (mandatory)

For ANY UI or UX work, load these skills before writing code:

- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/design-taste-frontend/SKILL.md`
- `.claude/skills/emil-design-eng/SKILL.md`
- `.claude/skills/impeccable/SKILL.md`

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

Token definitions live in `apps/web/src/app/globals.css`.

## Typography

No Inter. No monospace as body font.
Stack: Geist Sans (body) + Geist Mono (code snippets and numeric data only).
Never hardcode font families, weights, or sizes in components — use Tailwind scale.

## Components

- shadcn/ui as base, always adapted to project tokens — never in default state
- Icons: `@phosphor-icons/react` — no lucide, no hand-rolled SVG paths
- Tokens first → Tailwind utilities second → arbitrary values never
