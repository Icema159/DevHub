import { Route, Routes } from 'react-router';

import { AppShell } from '../components/layout';
import {
  AuthLayout,
  EmailVerificationNotice,
  LoginPage,
  RegisterPage,
  useAuthStore,
  VerifyEmailPage,
} from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { ChatPage } from '../features/conversations';
import { DocumentDetailsPage, DocumentsPage } from '../features/documents';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { UiKitPage } from '../pages/UiKitPage';
import { HomeRoute, ProtectedRoute, PublicOnlyRoute } from './route-guards';

const uiKitPreviewUser = {
  email: 'developer@example.com',
  name: null,
};

function AuthenticatedAppShell() {
  const logout = useAuthStore((state) => state.logout);
  const operation = useAuthStore((state) => state.operation);
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return null;
  }

  return (
    <AppShell
      accountNotice={user.emailVerified ? undefined : <EmailVerificationNotice />}
      isLoggingOut={operation === 'logout'}
      onLogout={() => void logout()}
      user={user}
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<HomeRoute />} />

      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedAppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:documentId" element={<DocumentDetailsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page not found"
                description="This route is not part of the current frontend foundation."
              />
            }
          />
        </Route>
      </Route>

      <Route element={<AppShell user={uiKitPreviewUser} />}>
        <Route path="/ui-kit" element={<UiKitPage />} />
      </Route>
    </Routes>
  );
}
