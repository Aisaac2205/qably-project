import type { PricingTranslations } from '../../i18n/types';
import type { PricingTier } from '../data/tiers';

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

function buildProjectsFeature(tier: PricingTier, t: PricingTranslations): string {
  if (tier.projects === null) return t.projectsFeatureUnlimited;
  if (tier.projects === 1) return fill(t.projectsFeatureOne, { count: tier.projects });
  return fill(t.projectsFeatureOther, { count: tier.projects });
}

export function buildTierFeatures(tier: PricingTier, t: PricingTranslations): string[] {
  return [
    fill(t.membersFeature, { count: tier.members }),
    buildProjectsFeature(tier, t),
    fill(t.creditsFeature, { count: tier.monthlyAiCredits }),
    t.teamReviewFeature,
    ...t.sharedFeatures,
  ];
}
