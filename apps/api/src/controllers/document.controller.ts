import type { RequestHandler } from 'express';

import { documentDeletionService } from '../services/document-deletion.service.js';
import { documentRetryService } from '../services/document-retry.service.js';
import { getDocumentDetails, listDocuments, uploadDocument } from '../services/document.service.js';
import { AppError } from '../utils/app-error.js';
import { parseDocumentId, parseDocumentListQuery } from '../utils/document-input.js';
import { requireAuthenticatedUser } from '../utils/request-user.js';

export const createDocument: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const file = request.file;

  if (!file) {
    throw new AppError(400, 'FILE_REQUIRED', 'A PDF file is required in the file field');
  }

  const document = await uploadDocument({
    userId: authenticatedUser.userId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    content: file.buffer,
  });

  response.status(201).json({ document });
};

export const getDocuments: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const query = parseDocumentListQuery(request.query);
  const result = await listDocuments(authenticatedUser.userId, query);

  response.status(200).json({
    data: { documents: result.documents },
    meta: result.meta,
  });
};

export const getDocument: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const documentId = parseDocumentId(request.params.documentId);
  const document = await getDocumentDetails(documentId, authenticatedUser.userId);

  response.status(200).json({ data: { document } });
};

export const deleteDocument: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const documentId = parseDocumentId(request.params.documentId);
  const document = await documentDeletionService.deleteDocument(
    documentId,
    authenticatedUser.userId,
  );

  response.status(202).json({ data: { document } });
};

export const retryDocument: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const documentId = parseDocumentId(request.params.documentId);
  const document = await documentRetryService.retryDocument(documentId, authenticatedUser.userId);

  response.status(202).json({ data: { document } });
};
