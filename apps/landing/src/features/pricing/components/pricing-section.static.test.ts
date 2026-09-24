import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'PricingSection.tsx'), 'utf-8');

describe('PricingSection has no monthly/annual toggle, no fabricated price, no contact CTA', () => {
  it('renders no billing-cycle state (no monthly/annual toggle)', () => {
    expect(source).not.toMatch(/useState/);
    expect(source).not.toMatch(/billingCycle/);
  });

  it('never shows a fabricated "Custom" price', () => {
    expect(source).not.toMatch(/Custom/);
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
});
