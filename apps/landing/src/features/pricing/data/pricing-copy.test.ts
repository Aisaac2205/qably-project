import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/dictionaries/en';
import { es } from '../../i18n/dictionaries/es';

describe('pricing copy', () => {
  it.each([
    ['es', es],
    ['en', en],
  ])('%s never advertises a Spanish/English interface as a feature', (_locale, dictionary) => {
    const joined = dictionary.pricing.sharedFeatures.join(' ').toLowerCase();

    expect(joined).not.toMatch(/español e inglés|spanish and english/);
  });

  it.each([
    ['es', es],
    ['en', en],
  ])('%s every tier CTA reads the same start-free copy', (_locale, dictionary) => {
    const { gratuito, equipo, empresa } = dictionary.pricing.tiers;

    expect(equipo.cta).toBe(gratuito.cta);
    expect(empresa.cta).toBe(gratuito.cta);
  });

  it.each([
    ['es', es],
    ['en', en],
  ])('%s has a non-empty plan-upgrade note for the paid tiers', (_locale, dictionary) => {
    expect(dictionary.pricing.planUpgradeNote.length).toBeGreaterThan(0);
  });
});
