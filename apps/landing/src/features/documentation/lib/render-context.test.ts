import { describe, expect, it } from 'vitest';
import { en } from '../content/en';
import { es } from '../content/es';
import { createRenderContext } from './render-context';

describe('createRenderContext', () => {
  it('carries the locale and the copy labels of the content', () => {
    const ctx = createRenderContext(en, 'en');

    expect(ctx.locale).toBe('en');
    expect(ctx.copyLabel).toBe(en.copyCodeLabel);
    expect(ctx.copiedLabel).toBe(en.copiedLabel);
  });

  it('resolves a docs link to the path of its own locale', () => {
    const href = { kind: 'docs', slug: 'quickstart', anchor: 'step-4-report-ci' } as const;

    expect(createRenderContext(es, 'es').resolveLink(href)).toBe('/docs/quickstart#step-4-report-ci');
    expect(createRenderContext(en, 'en').resolveLink(href)).toBe('/en/docs/quickstart#step-4-report-ci');
  });

  it('resolves the docs root to the overview and an unknown page to null', () => {
    const ctx = createRenderContext(es, 'es');

    expect(ctx.resolveLink({ kind: 'docs', slug: null, anchor: null })).toBe('/docs');
    expect(ctx.resolveLink({ kind: 'docs', slug: 'not-a-page', anchor: null })).toBeNull();
  });
});
