import { Router } from 'express';

import { authRouter } from './auth.routes.js';
import { conversationRouter } from './conversation.routes.js';
import { documentRouter } from './document.routes.js';
import { healthRouter } from './health.routes.js';
import { searchRouter } from './search.routes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/conversations', conversationRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/search', searchRouter);
