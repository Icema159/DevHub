import { checkDatabaseConnection } from '../repositories/health.repository.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  api: 'running';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    await checkDatabaseConnection();

    return {
      status: 'ok',
      api: 'running',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Database health check failed', error);

    return {
      status: 'degraded',
      api: 'running',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
