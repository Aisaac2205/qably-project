import type { Plan } from '@qably/types';

export interface PricingTier {
  id: Plan;
  monthlyPriceUsd: number;
  members: number;
  projects: number | null;
  monthlyAiCredits: number;
  notificationIntegrations: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'gratuito',
    monthlyPriceUsd: 0,
    members: 3,
    projects: 1,
    monthlyAiCredits: 25,
    notificationIntegrations: false,
  },
  {
    id: 'equipo',
    monthlyPriceUsd: 20,
    members: 10,
    projects: 5,
    monthlyAiCredits: 300,
    notificationIntegrations: true,
  },
  {
    id: 'empresa',
    monthlyPriceUsd: 49,
    members: 25,
    projects: null,
    monthlyAiCredits: 1000,
    notificationIntegrations: true,
  },
];
