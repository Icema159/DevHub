import { BrowserRouter } from 'react-router';

import { ToastProvider } from '../components/ui';
import { AuthSessionBootstrap } from '../features/auth';
import { AppRoutes } from './router';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthSessionBootstrap>
          <AppRoutes />
        </AuthSessionBootstrap>
      </ToastProvider>
    </BrowserRouter>
  );
}
