import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_FILE = /\.(astro|tsx|ts)$/;

// The home page has its own docs teaser (DocumentationSection.tsx) that predates
// these rules; the guards below cover the docs reader.
const OUT_OF_SCOPE = new Set(['DocumentationSection.tsx']);

function readComponents(): { name: string; source: string }[] {
  return readdirSync(here)
    .filter((name) => SOURCE_FILE.test(name) && !name.endsWith('.test.ts') && !OUT_OF_SCOPE.has(name))
    .sort()
    .map((name) => ({ name, source: readFileSync(path.join(here, name), 'utf-8') }));
}

function readAstroComponents(): { name: string; source: string }[] {
  return readComponents().filter((file) => file.name.endsWith('.astro'));
}

function offenders(pattern: RegExp, files = readComponents()): string[] {
  return files.flatMap(({ name, source }) =>
    source
      .split('\n')
      .flatMap((line, index) => (pattern.test(line) ? [`${name}:${index + 1}: ${line.trim()}`] : [])),
  );
}

// Tailwind classes that paint a hue: a palette colour, or one of the status
// tokens (pass, fail, warn, running, blocked), which are functional and never
// decorative. The docs stay neutral: tone comes from an icon and a label.
const HUE_CLASS =
  /(?:^|[^\w-])(?:[a-z0-9-]+:)*(?:bg|text|border|ring|fill|stroke|decoration|outline|divide|from|via|to|accent|caret|shadow)-(?:amber|yellow|orange|red|rose|pink|fuchsia|purple|violet|indigo|blue|sky|cyan|teal|emerald|green|lime|warn|fail|pass|running|blocked)(?![\w])/;

describe('docs components: colour', () => {
  it('has components to check', () => {
    const names = readComponents().map((file) => file.name);

    expect(names).toContain('DocsBlocks.astro');
    expect(names).toContain('CodeGroup.astro');
  });

  it('never paints a hue: no amber, no warn, no status colour, no palette colour', () => {
    expect(offenders(HUE_CLASS)).toEqual([]);
  });

  it('never writes a colour literal: hex, rgb, hsl, oklch', () => {
    expect(offenders(/(?<![\w&$-])#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lch|lab)\(/)).toEqual([]);
  });
});

describe('docs components: Tailwind scale only', () => {
  it('uses no arbitrary values', () => {
    // `text-[11px]`, `bg-warn/[0.06]` and arbitrary variants such as `[&_strong]:font-bold`.
    const arbitraryValue = /(?:-|\/)\[[^\]\s]+\]|(?:^|[\s"'`])\[[&@][^\]\s]*\]:/;

    expect(offenders(arbitraryValue, readAstroComponents())).toEqual([]);
  });

  it('never sets display type tighter than tracking-tight', () => {
    expect(offenders(/tracking-(?:tighter|tightest)/)).toEqual([]);
  });
});

describe('docs components: safety and determinism', () => {
  it('never injects a string as HTML', () => {
    expect(offenders(/set:html|innerHTML|dangerouslySetInnerHTML|insertAdjacentHTML/)).toEqual([]);
  });

  it('derives every id from the content, never from a random or a clock value', () => {
    expect(offenders(/randomUUID|Math\.random|Date\.now|new Date\(/)).toEqual([]);
  });
});

describe('the callout', () => {
  const callout = readAstroComponents().find((file) => file.name === 'Callout.astro');

  it('exists as its own component', () => {
    expect(callout).toBeDefined();
  });

  it('is a note landmark with a bold lead-in label', () => {
    expect(callout?.source).toContain('role="note"');
    expect(callout?.source).toMatch(/<strong class="[^"]*font-semibold[^"]*text-fg[^"]*">/);
  });

  it('draws its icon from Phosphor, decorative and without a hue', () => {
    expect(callout?.source).toContain("from '@phosphor-icons/react'");
    expect(callout?.source).toContain('aria-hidden="true"');
    expect(callout?.source).toContain('text-fg-muted');
  });

  it('does not use a coloured side stripe', () => {
    expect(callout?.source).not.toMatch(/border-(?:l|r|s|e)(?:-\d)?\b/);
  });

  it('takes its label from the content, in the locale of the page', () => {
    expect(callout?.source).toContain('calloutInfo');
    expect(callout?.source).toContain('calloutWarning');
  });
});

describe('the tab strip of a code group', () => {
  const group = readAstroComponents().find((file) => file.name === 'CodeGroup.astro');

  it('keeps the ARIA tablist wiring', () => {
    expect(group?.source).toContain('role="tablist"');
    expect(group?.source).toContain('role="tab"');
    expect(group?.source).toContain('role="tabpanel"');
    expect(group?.source).toContain('aria-selected');
    expect(group?.source).toContain('aria-controls');
    expect(group?.source).toContain('aria-labelledby');
  });

  it('underlines the active tab and scrolls inside its own strip', () => {
    expect(group?.source).toContain('border-b-2');
    expect(group?.source).toContain('aria-selected:border-primary');
    expect(group?.source).toContain('overflow-x-auto');
  });

  it('takes its id from the page, not from a random value', () => {
    expect(group?.source).toContain('groupId');
  });
});
