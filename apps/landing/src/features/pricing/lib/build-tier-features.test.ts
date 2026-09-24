import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/dictionaries/es';
import { PRICING_TIERS } from '../data/tiers';
import { buildTierFeatures } from './build-tier-features';

const [gratuito, equipo, empresa] = PRICING_TIERS;

describe('buildTierFeatures', () => {
  it('uses the singular project template when the tier allows exactly 1 project', () => {
    const features = buildTierFeatures(gratuito, es.pricing);

    expect(features).toContain('3 miembros');
    expect(features).toContain('1 proyecto');
    expect(features).toContain('25 créditos de Aeris al mes');
  });

  it('uses the plural project template when the tier allows more than 1 project', () => {
    const features = buildTierFeatures(equipo, es.pricing);

    expect(features).toContain('10 miembros');
    expect(features).toContain('Hasta 5 proyectos');
    expect(features).toContain('300 créditos de Aeris al mes');
  });

  it('uses the unlimited project copy when the tier has no project cap', () => {
    const features = buildTierFeatures(empresa, es.pricing);

    expect(features).toContain('25 miembros');
    expect(features).toContain('Proyectos ilimitados');
    expect(features).toContain('1000 créditos de Aeris al mes');
  });

  it('appends the team-review explanation and every shared feature, in order, after the plan limits', () => {
    const features = buildTierFeatures(gratuito, es.pricing);
    const limitCount = 3;

    expect(features[limitCount]).toBe(es.pricing.teamReviewFeature);
    expect(features.slice(limitCount + 1)).toEqual(es.pricing.sharedFeatures);
    expect(features).toHaveLength(limitCount + 1 + es.pricing.sharedFeatures.length);
  });

  it('never lists notification integrations for a tier without the capability', () => {
    expect(gratuito.notificationIntegrations).toBe(false);
    expect(buildTierFeatures(gratuito, es.pricing)).not.toContain(
      es.pricing.notificationsFeature,
    );
  });

  it('lists notification integrations for tiers with the capability', () => {
    expect(buildTierFeatures(equipo, es.pricing)).toContain(
      es.pricing.notificationsFeature,
    );
    expect(buildTierFeatures(empresa, es.pricing)).toContain(
      es.pricing.notificationsFeature,
    );
  });

  it('lists the bring-your-own-model feature only for empresa', () => {
    expect(buildTierFeatures(empresa, es.pricing)).toContain(es.pricing.byokFeature);
    expect(buildTierFeatures(gratuito, es.pricing)).not.toContain(es.pricing.byokFeature);
    expect(buildTierFeatures(equipo, es.pricing)).not.toContain(es.pricing.byokFeature);
  });
});
