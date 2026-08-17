# Qably product UI polish

## Intent

Qably should feel like a calibrated QA instrument: precise, calm, and
traceable. The product UI serves an active technical task; it must not resemble
a generic analytics or AI-template dashboard.

## Visual decisions

- Use a cool, near-white canvas outside persistent navigation. Surfaces are
  true white and appear only where grouping or interaction earns separation.
- Use the existing indigo structural role for sidebar chrome and a restrained
  garnet primary accent. AI content uses the brand accent sparingly, never
  purple as decoration.
- Geist Sans is the UI typeface. Geist Mono is reserved for source files,
  hashes, command-like values, and other code-adjacent identifiers.
- Prefer aligned sections, dividers, and operational rows over repeated
  icon-plus-number cards.
- Treat semantic colors as status-only. A passing, failing, blocked, or running
  state must always include a textual label or icon as well as color.

## Dashboard hierarchy

1. A concise workspace heading establishes context.
2. A single labelled metric strip gives a fast operational scan.
3. Project health is the primary comparison surface.
4. Trend, AI-review queue, runs, and CI activity support the next QA decision.

## Motion

- Use 150–200 ms state transitions for hover, selection, and feedback.
- Do not stagger or animate cards on page load.
- Only live operational states may use an active indicator.
- Respect `prefers-reduced-motion` everywhere.
