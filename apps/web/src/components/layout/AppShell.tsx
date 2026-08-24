import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { cn } from '../../lib/cn';
import type { ShellUser } from '../../lib/user';
import { IconButton } from '../ui';
import { AmbientLightLayer } from './AmbientLightLayer';
import { AppSidebar } from './AppSidebar';
import { Brand } from './Brand';

export interface AppShellProps {
  accountNotice?: ReactNode;
  isLoggingOut?: boolean;
  onLogout?: () => void;
  user: ShellUser;
}

export function AppShell({ accountNotice, isLoggingOut = false, onLogout, user }: AppShellProps) {
  const location = useLocation();
  const isChatRoute = /^\/chat(?:\/|$)/.test(location.pathname);
  const isDashboardRoute = location.pathname === '/dashboard';
  const isDocumentsRoute = /^\/documents(?:\/|$)/.test(location.pathname);
  const usesLivingGlassIdentity = isChatRoute || isDashboardRoute || isDocumentsRoute;
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (mobileNavigationOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-drawer-initial-focus]')?.focus();
    }

    if (!mobileNavigationOpen && dialog.open) {
      dialog.close();
    }
  }, [mobileNavigationOpen]);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia('(min-width: 1024px)');
    const closeDrawerAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavigationOpen(false);
      }
    };

    desktopBreakpoint.addEventListener('change', closeDrawerAtDesktop);

    return () => {
      desktopBreakpoint.removeEventListener('change', closeDrawerAtDesktop);
    };
  }, []);

  const closeMobileNavigation = () => {
    setMobileNavigationOpen(false);
  };

  return (
    <div
      className={cn(
        'app-canvas relative isolate min-h-dvh overflow-x-hidden',
        usesLivingGlassIdentity && 'living-glass-identity',
        isChatRoute && 'chat-identity',
        isDashboardRoute && 'dashboard-identity',
        isDocumentsRoute && 'documents-identity',
      )}
    >
      <a
        href="#main-content"
        className="focus-material fixed top-3 left-3 z-[60] -translate-y-20 rounded-control bg-primary px-4 py-2 type-body font-semibold text-on-primary transition focus:translate-y-0"
      >
        Skip to main content
      </a>

      {usesLivingGlassIdentity ? <AmbientLightLayer /> : null}

      <aside className="material-navigation elevation-1 fixed inset-y-3 left-3 z-30 hidden w-[17rem] overflow-hidden rounded-glass border p-5 lg:block">
        <AppSidebar isLoggingOut={isLoggingOut} user={user} {...(onLogout ? { onLogout } : {})} />
      </aside>

      <header className="material-workspace elevation-0 sticky top-0 z-20 flex min-h-16 items-center justify-between border-x-0 border-t-0 border-b px-4 lg:hidden">
        <Brand className="[&>span:last-child]:hidden sm:[&>span:last-child]:block" />
        <IconButton
          ref={menuButtonRef}
          label="Open navigation"
          onClick={() => setMobileNavigationOpen(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </IconButton>
      </header>

      <dialog
        ref={dialogRef}
        className="material-navigation elevation-2 m-0 h-dvh max-h-none w-[min(20rem,calc(100%-3rem))] max-w-none overflow-hidden rounded-r-glass border p-0 text-foreground backdrop:bg-slate-950/25 lg:hidden"
        aria-label="Mobile navigation"
        onCancel={(event) => {
          event.preventDefault();
          closeMobileNavigation();
        }}
        onClose={() => {
          setMobileNavigationOpen(false);
          if (window.matchMedia('(min-width: 1024px)').matches) {
            document.querySelector<HTMLElement>('aside a[aria-current="page"]')?.focus();
          } else {
            menuButtonRef.current?.focus();
          }
        }}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-3 flex justify-end">
            <IconButton
              data-drawer-initial-focus
              label="Close navigation"
              onClick={closeMobileNavigation}
            >
              <X className="size-5" aria-hidden="true" />
            </IconButton>
          </div>
          <AppSidebar
            isLoggingOut={isLoggingOut}
            user={user}
            onNavigate={closeMobileNavigation}
            {...(onLogout ? { onLogout } : {})}
          />
        </div>
      </dialog>

      <main
        id="main-content"
        className="relative z-10 min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:ml-[18.5rem] lg:px-8 lg:py-10"
      >
        <div className="mx-auto w-full max-w-[90rem]">
          {accountNotice ? <div className="mb-6">{accountNotice}</div> : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
