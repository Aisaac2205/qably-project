import type { Plan } from './index';

export interface PlanLimits {
  members: number;
  projects: number | null;
  monthlyAiCredits: number;
  notificationIntegrations: boolean;
  maxSourceCharacters: number;
}

export type PublicPlanLimits = Omit<PlanLimits, 'maxSourceCharacters'>;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  gratuito: {
    members: 3,
    projects: 1,
    monthlyAiCredits: 25,
    notificationIntegrations: false,
    maxSourceCharacters: 60_000,
  },
  equipo: {
    members: 10,
    projects: 5,
    monthlyAiCredits: 300,
    notificationIntegrations: true,
    maxSourceCharacters: 60_000,
  },
  empresa: {
    members: 25,
    projects: null,
    monthlyAiCredits: 1000,
    notificationIntegrations: true,
    maxSourceCharacters: 1_000_000,
  },
};

export function publicPlanLimits(plan: Plan): PublicPlanLimits {
  const { members, projects, monthlyAiCredits, notificationIntegrations } =
    PLAN_LIMITS[plan];

  return { members, projects, monthlyAiCredits, notificationIntegrations };
}

export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function nextMonthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export interface CreditPeriodState {
  aiCreditsUsed: number;
  aiCreditsPeriodStart: Date;
}

export function creditsUsedAt(org: CreditPeriodState, now: Date): number {
  return org.aiCreditsPeriodStart < monthStartUtc(now) ? 0 : org.aiCreditsUsed;
}
