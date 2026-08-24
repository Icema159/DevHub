export interface ShellUser {
  email: string;
  emailVerified?: boolean;
  name?: string | null;
}

export function getUserInitials(user: ShellUser): string {
  const nameParts = user.name?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (nameParts.length > 0) {
    const firstInitial = nameParts[0]?.charAt(0) ?? '';
    const lastInitial = nameParts.length > 1 ? (nameParts.at(-1)?.charAt(0) ?? '') : '';

    return `${firstInitial}${lastInitial}`.toUpperCase();
  }

  const emailName = user.email.split('@')[0] ?? '';
  const emailParts = emailName.split(/[._+-]+/).filter(Boolean);
  const initials = emailParts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  return (initials || emailName.slice(0, 2) || 'U').toUpperCase();
}
