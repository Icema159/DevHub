import cors from 'cors';
import express from 'express';

import { env } from './config/env.js';
import {
  createOriginValidationMiddleware,
  createSecurityHeadersMiddleware,
} from './middleware/browser-security.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.trustedProxyHops === 0 ? false : env.trustedProxyHops);
app.use(
  createSecurityHeadersMiddleware({
    corsOrigin: env.corsOrigin,
    nodeEnvironment: env.nodeEnv,
  }),
);
app.use(createOriginValidationMiddleware(env.corsOrigin));
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
