import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS } from '@qably/types';
import { PRICING_TIERS } from './tiers';

describe('landing pricing tiers match @qably/types PLAN_LIMITS', () => {
  it('lists exactly 3 tiers, one per plan', () => {
    expect(PRICING_TIERS).toHaveLength(3);
    expect(PRICING_TIERS.map((tier) => tier.id).sort()).toEqual(
      Object.keys(PLAN_LIMITS).sort(),
    );
  });

  it.each(PRICING_TIERS)('$id members/projects/credits match PLAN_LIMITS', (tier) => {
    const limits = PLAN_LIMITS[tier.id];

    expect(tier.members).toBe(limits.members);
    expect(tier.projects).toBe(limits.projects);
    expect(tier.monthlyAiCredits).toBe(limits.monthlyAiCredits);
  });

  it.each(PRICING_TIERS)('$id notificationIntegrations matches PLAN_LIMITS', (tier) => {
    const limits = PLAN_LIMITS[tier.id];

    expect(tier.notificationIntegrations).toBe(limits.notificationIntegrations);
  });

  it('carries no price: nothing in the product charges for a plan', () => {
    for (const tier of PRICING_TIERS) {
      expect(Object.keys(tier).sort()).toEqual(
        ['id', 'members', 'monthlyAiCredits', 'notificationIntegrations', 'projects'],
      );
    }
  });
});
