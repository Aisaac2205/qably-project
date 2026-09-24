import type { Plan } from './index';

export interface PlanLimits {
  members: number;
  projects: number | null;
  monthlyAiCredits: number;
  notificationIntegrations: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  gratuito: {
    members: 3,
    projects: 1,
    monthlyAiCredits: 25,
    notificationIntegrations: false,
  },
  equipo: {
    members: 10,
    projects: 5,
    monthlyAiCredits: 300,
    notificationIntegrations: true,
  },
  empresa: {
    members: 25,
    projects: null,
    monthlyAiCredits: 1000,
    notificationIntegrations: true,
  },
};

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
