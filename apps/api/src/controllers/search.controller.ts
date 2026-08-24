import type { RequestHandler } from 'express';

import { retrievalService } from '../services/retrieval.service.js';
import { requireAuthenticatedUser } from '../utils/request-user.js';
import { parseSearchInput } from '../utils/search-input.js';

export const searchDocuments: RequestHandler = async (request, response) => {
  const authenticatedUser = requireAuthenticatedUser(request);
  const input = parseSearchInput(request.body);
  const results = await retrievalService.search(authenticatedUser.userId, input.query);

  response.status(200).json({ results });
};
