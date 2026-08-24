import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '../../lib/cn';

export interface SidebarNavItemProps {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
  to: string;
}

export function SidebarNavItem({ active, icon: Icon, label, onNavigate, to }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={({ isActive }) =>
        cn(
          'focus-material relative flex min-h-11 items-center gap-3 overflow-hidden rounded-control border border-transparent px-3 type-body font-medium text-secondary transition',
          'hover:bg-white/70 hover:text-foreground',
          (active ?? isActive) && 'material-selected border-primary/15 text-primary',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className="size-5"
            strokeWidth={(active ?? isActive) ? 2 : 1.75}
            aria-hidden="true"
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
