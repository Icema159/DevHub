import type { AuthenticatedUser } from '../types/authenticated-user.js';
import { AppError } from '../utils/app-error.js';

export interface OwnedResource {
  userId: string;
}

export function authorizeResourceOwner<TResource extends OwnedResource>(
  authenticatedUser: AuthenticatedUser,
  resource: TResource,
): TResource {
  if (resource.userId !== authenticatedUser.userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource');
  }

  return resource;
}
