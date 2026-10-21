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

describe('tables', () => {
  it('scroll inside their own box on a phone instead of crushing their columns', () => {
    const blocks = component('DocsBlocks.astro');

    expect(blocks).toContain('overflow-x-auto rounded-xl border border-border');
    expect(blocks).toMatch(/<table class="[^"]*min-w-lg/);
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

function component(name: string): string {
  const file = readComponents().find((candidate) => candidate.name === name);

  if (file === undefined) throw new Error(`missing docs component ${name}`);

  return file.source;
}

describe('the rails, the navigation and the contents list', () => {
  const globalCss = readFileSync(path.resolve(here, '../../../styles/global.css'), 'utf-8');

  it('sizes both rails from tokens, never from a fixed width', () => {
    expect(globalCss).toContain('--docs-sidebar-width');
    expect(globalCss).toContain('--docs-toc-width');
    expect(component('DocsSidebar.astro')).toContain('w-docs-sidebar');
    expect(component('DocsToc.astro')).toContain('w-docs-toc');
    expect(component('DocsPage.astro')).not.toMatch(/\bw-(?:56|64)\b/);
  });

  it('keeps the page free of a global style block: the pinned rails are plain utilities', () => {
    expect(component('DocsPage.astro')).not.toContain('<style');

    for (const name of ['DocsSidebar.astro', 'DocsToc.astro']) {
      expect(component(name), name).toMatch(/sticky[^"]*top-docs-offset|top-docs-offset[^"]*sticky/);
      expect(component(name), name).toContain('max-h-docs-rail');
    }
  });

  it('stretches the contents column to the height of the article so its pinned list can travel', () => {
    expect(component('DocsToc.astro')).toMatch(/w-docs-toc[^"]*self-stretch/);
  });

  it('marks the current page with a soft filled pill and aria-current', () => {
    const list = component('DocsNavList.astro');

    expect(list).toContain("'page'");
    expect(list).toContain('aria-current');
    expect(list).toContain('bg-bg-elevated text-fg');
    expect(list).toMatch(/text-sm font-semibold text-fg/);
  });

  it('gives the rows of the collapsible menu a 44px touch target', () => {
    expect(component('DocsMobileNav.astro')).toContain('min-h-11');
    expect(component('DocsNavList.astro')).toContain('min-h-11');
    expect(component('DocsTocList.astro')).toContain('min-h-11');
  });

  it('titles the contents list with a Phosphor List icon', () => {
    const toc = component('DocsToc.astro');

    expect(toc).toMatch(/import \{[^}]*\bList\b[^}]*\} from '@phosphor-icons\/react'/);
    expect(toc).toContain('aria-hidden="true"');
  });

  it('marks the entry being read with a 2px rule and the full foreground', () => {
    const list = component('DocsTocList.astro');

    expect(list).toContain('border-l-2');
    expect(list).toContain('data-active:border-primary');
    expect(list).toContain('data-active:text-fg');
    expect(list).toContain('text-fg-muted');
    expect(list).not.toContain('data-active:font-');
  });

  it('only animates colour, and not under prefers-reduced-motion', () => {
    for (const name of ['DocsNavList.astro', 'DocsTocList.astro', 'DocsPager.astro']) {
      const source = component(name);

      expect(source, name).toContain('transition-colors');
      expect(source, name).toContain('motion-reduce:transition-none');
      expect(source, name).not.toMatch(/transition-(?:all|transform)/);
    }
  });

  it('brightens the border and the title of a pager card on hover', () => {
    const pager = component('DocsPager.astro');

    expect(pager).toContain('hover:border-border-strong');
    expect(pager).toContain('group-hover:text-fg');
  });
});

describe('the diagram', () => {
  it('is a figure with a visible caption and a purely visual drawing', () => {
    const diagram = component('Diagram.astro');

    expect(diagram).toContain('<figure');
    expect(diagram).toContain('<figcaption');
    expect(diagram).toContain('aria-hidden="true"');
  });

  it('carries the same data as an ordered list for assistive technology', () => {
    const diagram = component('Diagram.astro');

    expect(diagram).toMatch(/<div class="sr-only">/);
    expect(diagram).toContain('<ol');
    expect(diagram).toContain('describeDiagramSteps');
  });

  it('draws lanes as dashed boxes and flows in a row from md, in a column on phones', () => {
    const diagram = component('Diagram.astro');

    expect(diagram).toContain('border-dashed');
    expect(diagram).toContain('md:flex-row');
    expect(diagram).toContain('flex-col');
  });

  it('is rendered for the diagram block', () => {
    expect(component('DocsBlocks.astro')).toContain("block.type === 'diagram'");
  });
});
