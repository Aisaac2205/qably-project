import { z } from 'zod';

export const dashboardSummaryQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export const TRACEABILITY_MIN_YEAR = 2020;
export const TRACEABILITY_MAX_YEAR = 2100;

export const dashboardTraceabilityQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  year: z.coerce
    .number()
    .int()
    .min(TRACEABILITY_MIN_YEAR)
    .max(TRACEABILITY_MAX_YEAR),
});

export type DashboardTraceabilityQuery = z.infer<
  typeof dashboardTraceabilityQuerySchema
>;
