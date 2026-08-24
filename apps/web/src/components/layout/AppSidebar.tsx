import { FileText, LayoutDashboard, LogOut, MessagesSquare } from 'lucide-react';

import { getUserInitials, type ShellUser } from '../../lib/user';
import { SidebarNavItem } from '../composed';
import { Button } from '../ui';
import { Brand } from './Brand';

export interface AppSidebarProps {
  isLoggingOut?: boolean;
  onNavigate?: () => void;
  onLogout?: () => void;
  user: ShellUser;
}

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: FileText, label: 'Documents', to: '/documents' },
  { icon: MessagesSquare, label: 'Chat', to: '/chat' },
] as const;

export function AppSidebar({ isLoggingOut = false, onLogout, onNavigate, user }: AppSidebarProps) {
  const displayName = user.name?.trim() || user.email;

  const handleLogout = () => {
    onNavigate?.();
    onLogout?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brand />
      <nav className="mt-10 grid gap-2" aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <SidebarNavItem
            key={item.to}
            {...item}
            {...(onNavigate === undefined ? {} : { onNavigate })}
          />
        ))}
      </nav>
      <div className="mt-auto border-t border-border/80 pt-5">
        <div className="flex min-w-0 items-center gap-3 rounded-control px-2 py-2">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft type-small font-semibold text-primary"
            aria-hidden="true"
          >
            {getUserInitials(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate type-body font-medium text-foreground">{displayName}</p>
            {user.name?.trim() ? (
              <p className="truncate type-small text-muted">{user.email}</p>
            ) : null}
          </div>
        </div>
        {onLogout ? (
          <Button
            className="mt-2 w-full justify-start"
            isLoading={isLoggingOut}
            loadingLabel="Signing out…"
            onClick={handleLogout}
            variant="ghost"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Button>
        ) : null}
      </div>
    </div>
  );
}
