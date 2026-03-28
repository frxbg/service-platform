import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { useAuth } from './context/AuthContext';
import LoginPage from './pages/Login';
import WorkboardPage from './pages/Workboard';
import RequestDetailsPage from './pages/RequestDetails';
import ClientsPage from './pages/Clients';
import ClientDetailsPage from './pages/ClientDetails';
import MaterialsPage from './pages/Materials';
import ProfilePage from './pages/Profile';

function FullScreenLoader() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        gap: 2,
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress />
      <Typography>{t('common.loading')}</Typography>
    </Box>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/"
        element={<Navigate to="/requests" replace />}
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <WorkboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests/:requestId"
        element={
          <ProtectedRoute>
            <RequestDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <ClientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:clientId"
        element={
          <ProtectedRoute>
            <ClientDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <MaterialsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
