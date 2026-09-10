import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';
import { AI_DAILY_BUDGET_REDIS } from './ai.tokens';

const KEY_PREFIX = 'aeris:daily-budget:';
const PACIFIC_TIMEZONE = 'America/Los_Angeles';
const KEY_TTL_SECONDS = 26 * 60 * 60;

export interface BudgetRedisClient {
  incr: (key: string) => Promise<number>;
  decr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  quit: () => Promise<unknown>;
}

export interface DailyBudgetCheck {
  isByok: boolean;
}

function pacificDayKey(now: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return `${KEY_PREFIX}${formatter.format(now)}`;
}

@Injectable()
export class AiDailyBudget implements OnModuleDestroy {
  constructor(
    @Inject(AI_DAILY_BUDGET_REDIS) private readonly redis: BudgetRedisClient,
    @InjectEnv() private readonly env: Env,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async tryConsume(check: DailyBudgetCheck): Promise<boolean> {
    if (check.isByok) return true;
    if (this.env.AERIS_DAILY_BUDGET === undefined) return true;

    const key = pacificDayKey(new Date());
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, KEY_TTL_SECONDS);
    }

    if (count > this.env.AERIS_DAILY_BUDGET) {
      await this.redis.decr(key);
      return false;
    }

    return true;
  }
}
