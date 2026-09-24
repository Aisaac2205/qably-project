import { describe, it, expect } from 'vitest';
import {
  PLAN_LIMITS,
  monthStartUtc,
  nextMonthStartUtc,
  creditsUsedAt,
} from './plans';

describe('PLAN_LIMITS', () => {
  it('gratuito allows 3 members, 1 project and 25 monthly Aeris credits, no notification integrations', () => {
    expect(PLAN_LIMITS.gratuito).toEqual({
      members: 3,
      projects: 1,
      monthlyAiCredits: 25,
      notificationIntegrations: false,
    });
  });

  it('equipo allows 10 members, 5 projects, 300 monthly Aeris credits and notification integrations', () => {
    expect(PLAN_LIMITS.equipo).toEqual({
      members: 10,
      projects: 5,
      monthlyAiCredits: 300,
      notificationIntegrations: true,
    });
  });

  it('empresa allows 25 members, unlimited projects, 1000 monthly Aeris credits and notification integrations', () => {
    expect(PLAN_LIMITS.empresa).toEqual({
      members: 25,
      projects: null,
      monthlyAiCredits: 1000,
      notificationIntegrations: true,
    });
  });
});

describe('monthStartUtc', () => {
  it('returns the first instant of the UTC month for a mid-month date', () => {
    const result = monthStartUtc(new Date('2026-09-23T17:48:12Z'));
    expect(result.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('is idempotent when given the first instant of the month', () => {
    const result = monthStartUtc(new Date('2026-01-01T00:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('nextMonthStartUtc', () => {
  it('returns the first instant of the following UTC month', () => {
    const result = nextMonthStartUtc(new Date('2026-09-23T17:48:12Z'));
    expect(result.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('rolls over the UTC year at a December boundary', () => {
    const result = nextMonthStartUtc(new Date('2026-12-15T00:00:00.000Z'));
    expect(result.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('creditsUsedAt', () => {
  it('returns the stored usage when the period has not rolled over', () => {
    const org = {
      aiCreditsUsed: 12,
      aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    };
    const now = new Date('2026-09-23T17:48:12Z');
    expect(creditsUsedAt(org, now)).toBe(12);
  });

  it('resets to zero without mutating storage when the period elapsed', () => {
    const org = {
      aiCreditsUsed: 12,
      aiCreditsPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
    };
    const now = new Date('2026-09-23T17:48:12Z');
    expect(creditsUsedAt(org, now)).toBe(0);
  });

  it('treats a period starting exactly at the current UTC month boundary as current', () => {
    const org = {
      aiCreditsUsed: 5,
      aiCreditsPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    };
    const now = new Date('2026-09-01T00:00:00.001Z');
    expect(creditsUsedAt(org, now)).toBe(5);
  });
});
