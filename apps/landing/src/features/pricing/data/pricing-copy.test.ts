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
    ['es', es, 'Crear cuenta'],
    ['en', en, 'Create account'],
  ])('%s every tier CTA reads the same create-account copy', (_locale, dictionary, expected) => {
    const { gratuito, equipo, empresa } = dictionary.pricing.tiers;

    expect(gratuito.cta).toBe(expected);
    expect(equipo.cta).toBe(expected);
    expect(empresa.cta).toBe(expected);
  });

  it.each([
    ['es', es, /cobro/i],
    ['en', en, /billing/i],
  ])('%s says that billing and plan changes are not part of this version', (_locale, dictionary, billing) => {
    expect(dictionary.pricing.planUpgradeNote).toMatch(billing);
  });

  it.each([
    ['es', es],
    ['en', en],
  ])('%s carries no price or billing-period copy', (_locale, dictionary) => {
    expect(dictionary.pricing).not.toHaveProperty('perMonth');
    expect(dictionary.pricing).not.toHaveProperty('mostPopularBadge');
    expect(dictionary.pricing).not.toHaveProperty('byokFeature');
  });
});
