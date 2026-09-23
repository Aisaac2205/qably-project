export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function isDashboardPeriod(value: number): value is DashboardPeriod {
  return (DASHBOARD_PERIODS as readonly number[]).includes(value);
}
