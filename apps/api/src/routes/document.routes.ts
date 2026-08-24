import { Router } from 'express';

import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocuments,
  retryDocument,
} from '../controllers/document.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { privateNoStore } from '../middleware/browser-security.js';
import { requireCsrfToken } from '../middleware/csrf.js';
import { uploadDocumentFile } from '../middleware/document-upload.js';
import { requireVerifiedEmail } from '../middleware/require-verified-email.js';
import { limitUploadByIp } from '../middleware/resource-rate-limit.js';

export const documentRouter = Router();

documentRouter.use(privateNoStore);
documentRouter.use(authenticate);
documentRouter.use(requireCsrfToken);
documentRouter.get('/', getDocuments);
documentRouter.get('/:documentId', getDocument);
documentRouter.post('/:documentId/retry', requireVerifiedEmail, retryDocument);
documentRouter.delete('/:documentId', deleteDocument);
documentRouter.post('/', requireVerifiedEmail, limitUploadByIp, uploadDocumentFile, createDocument);
