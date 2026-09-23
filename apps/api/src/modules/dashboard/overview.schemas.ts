import { isDashboardPeriod } from '@qably/types';
import { z } from 'zod';
import { timeZoneQuerySchema } from '../../common/time-zone/time-zone-query.schema';

export const dashboardOverviewQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  period: z.coerce.number().transform((value, ctx) => {
    if (!isDashboardPeriod(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'period must be 7, 30 or 90',
      });
      return z.NEVER;
    }

    return value;
  }),
  tz: timeZoneQuerySchema,
});

export type DashboardOverviewQuery = z.infer<
  typeof dashboardOverviewQuerySchema
>;
