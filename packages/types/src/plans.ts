import type { Plan } from './index';

export interface PlanLimits {
  members: number;
  projects: number | null;
  monthlyAiCredits: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  gratuito: { members: 3, projects: 1, monthlyAiCredits: 25 },
  equipo: { members: 10, projects: 5, monthlyAiCredits: 300 },
  empresa: { members: 25, projects: null, monthlyAiCredits: 1000 },
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
