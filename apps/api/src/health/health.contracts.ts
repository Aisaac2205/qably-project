export const DATABASE_PROBE = Symbol('DATABASE_PROBE');

export interface DatabaseProbe {
  ping(): Promise<void>;
}

export type HealthStatus = 'ok' | 'degraded';
export type DependencyStatus = 'up' | 'down';

export interface HealthReport {
  status: HealthStatus;
  database: DependencyStatus;
  uptimeSeconds: number;
  timestamp: string;
}
