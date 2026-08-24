import type { RequestHandler } from 'express';

import { getHealthStatus } from '../services/health.service.js';

export const getHealth: RequestHandler = async (_request, response) => {
  const health = await getHealthStatus();
  const statusCode = health.database === 'connected' ? 200 : 503;

  response.status(statusCode).json(health);
};
