import { z } from 'zod';
import { timeZoneQuerySchema } from '../../common/time-zone/time-zone-query.schema';

export const dashboardChannelsQuerySchema = z.object({
  tz: timeZoneQuerySchema,
});

export type DashboardChannelsQuery = z.infer<
  typeof dashboardChannelsQuerySchema
>;
