import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'PricingSection.tsx'), 'utf-8');

describe('PricingSection presents plan limits only: no price, no toggle, no purchase flow', () => {
  it('renders no billing-cycle state (no monthly/annual toggle)', () => {
    expect(source).not.toMatch(/useState/);
    expect(source).not.toMatch(/billingCycle/);
  });

  it('never renders a price or a billing period', () => {
    expect(source).not.toMatch(/monthlyPriceUsd/);
    expect(source).not.toMatch(/perMonth/);
    expect(source).not.toMatch(/\$\{/);
  });

  it('never shows a fabricated "Custom" price', () => {
    expect(source).not.toMatch(/Custom/);
  });

  it('never highlights a tier as the most chosen one', () => {
    expect(source).not.toMatch(/mostPopularBadge/);
    expect(source).not.toMatch(/FEATURED_TIER_ID/);
  });

  it('never links to a sales/contact email', () => {
    expect(source).not.toMatch(/mailto:/);
  });

  it('never nests a <button> inside an <a> (invalid HTML for the CTA links)', () => {
    expect(source).not.toMatch(/<button/);
  });

  it('renders one CTA anchor per tier by mapping over the 3-tier PRICING_TIERS data', () => {
    const anchorMatches = source.match(/<a\s+href=\{authUrl\}/g) ?? [];

    expect(anchorMatches).toHaveLength(1);
    expect(source).toMatch(/PRICING_TIERS\.map/);
  });

  it('states once, outside the tier cards, that billing and plan changes are not available', () => {
    const noteMatches = source.match(/planUpgradeNote/g) ?? [];

    expect(noteMatches).toHaveLength(1);
    expect(source).not.toMatch(/tier\.id\s*!==\s*'gratuito'/);
  });
});
