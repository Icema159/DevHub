const protectedDestinations = ['/dashboard', '/documents', '/chat'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getSafeDestination(state: unknown): string {
  if (!isRecord(state) || typeof state.from !== 'string') {
    return '/dashboard';
  }

  const destination = state.from;
  const isProtectedDestination = protectedDestinations.some(
    (path) => destination === path || destination.startsWith(`${path}/`),
  );

  return isProtectedDestination ? destination : '/dashboard';
}

export function getRegisteredEmail(state: unknown): string | null {
  if (!isRecord(state) || state.registrationComplete !== true || typeof state.email !== 'string') {
    return null;
  }

  return state.email;
}
