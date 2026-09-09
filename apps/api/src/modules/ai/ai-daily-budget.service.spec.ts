import type { Env } from '../../config/env';
import { AiDailyBudget, type BudgetRedisClient } from './ai-daily-budget.service';

function env(overrides: Partial<Env> = {}): Env {
  return { AERIS_DAILY_BUDGET: 100, ...overrides } as Env;
}

function fakeRedis(overrides: Partial<BudgetRedisClient> = {}): BudgetRedisClient {
  return {
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    ...overrides,
  };
}

describe('AiDailyBudget.tryConsume', () => {
  it('allows the call and increments the counter when under budget', async () => {
    const redis = fakeRedis({ incr: jest.fn().mockResolvedValue(5) });

    const allowed = await new AiDailyBudget(redis, env({ AERIS_DAILY_BUDGET: 100 })).tryConsume({
      isByok: false,
    });

    expect(allowed).toBe(true);
    expect(redis.incr).toHaveBeenCalledTimes(1);
  });

  it('sets an expiry only on the first increment of the day', async () => {
    const redis = fakeRedis({ incr: jest.fn().mockResolvedValue(1) });

    await new AiDailyBudget(redis, env()).tryConsume({ isByok: false });

    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it('does not set an expiry on a later increment of the same day', async () => {
    const redis = fakeRedis({ incr: jest.fn().mockResolvedValue(2) });

    await new AiDailyBudget(redis, env()).tryConsume({ isByok: false });

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('blocks and rolls the increment back once the count would exceed the budget', async () => {
    const redis = fakeRedis({ incr: jest.fn().mockResolvedValue(101) });

    const allowed = await new AiDailyBudget(redis, env({ AERIS_DAILY_BUDGET: 100 })).tryConsume(
      { isByok: false },
    );

    expect(allowed).toBe(false);
    expect(redis.decr).toHaveBeenCalledTimes(1);
  });

  it('allows the call exactly at the budget boundary', async () => {
    const redis = fakeRedis({ incr: jest.fn().mockResolvedValue(100) });

    const allowed = await new AiDailyBudget(redis, env({ AERIS_DAILY_BUDGET: 100 })).tryConsume(
      { isByok: false },
    );

    expect(allowed).toBe(true);
    expect(redis.decr).not.toHaveBeenCalled();
  });

  it('never touches redis when no budget is configured', async () => {
    const redis = fakeRedis();

    const allowed = await new AiDailyBudget(
      redis,
      env({ AERIS_DAILY_BUDGET: undefined }),
    ).tryConsume({ isByok: false });

    expect(allowed).toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('never touches redis for a call flagged as bring-your-own-key', async () => {
    const redis = fakeRedis();

    const allowed = await new AiDailyBudget(redis, env()).tryConsume({
      isByok: true,
    });

    expect(allowed).toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('keys the counter by the Pacific calendar day, not UTC', async () => {
    const incr = jest.fn().mockResolvedValue(1);

    await new AiDailyBudget(fakeRedis({ incr }), env()).tryConsume({
      isByok: false,
    });

    const [key] = incr.mock.calls[0] as [string];
    expect(key).toMatch(/^aeris:daily-budget:\d{4}-\d{2}-\d{2}$/);
  });

  it('keys two instants that share a Pacific day but not a UTC day identically', async () => {
    const beforeUtcMidnight = new Date('2026-03-10T23:30:00Z');
    const afterUtcMidnight = new Date('2026-03-11T05:30:00Z');
    const keys: string[] = [];
    const redis = fakeRedis({
      incr: jest.fn().mockImplementation((key: string) => {
        keys.push(key);
        return Promise.resolve(1);
      }),
    });
    const budget = new AiDailyBudget(redis, env());

    jest.useFakeTimers().setSystemTime(beforeUtcMidnight);
    await budget.tryConsume({ isByok: false });
    jest.setSystemTime(afterUtcMidnight);
    await budget.tryConsume({ isByok: false });
    jest.useRealTimers();

    expect(keys[0]).toBe(keys[1]);
  });
});

describe('AiDailyBudget.onModuleDestroy', () => {
  it('closes the redis connection it owns', async () => {
    const redis = fakeRedis();

    await new AiDailyBudget(redis, env()).onModuleDestroy();

    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
