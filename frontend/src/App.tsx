import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Box, CircularProgress } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useBootstrapStatus } from './hooks/useBootstrapStatus';
import Layout from './components/Layout';
import Login from './pages/Login';

const Clients = lazy(() => import('./pages/Clients'));
const Materials = lazy(() => import('./pages/Materials'));
const MaterialDetails = lazy(() => import('./pages/MaterialDetails'));
const ServiceRequests = lazy(() => import('./pages/ServiceRequests'));
const ServiceRequestCreate = lazy(() => import('./pages/ServiceRequestCreate'));
const ServiceRequestDetails = lazy(() => import('./pages/ServiceRequestDetails'));
const Offers = lazy(() => import('./pages/Offers'));
const OfferEditor = lazy(() => import('./pages/OfferEditor'));
const OfferDetails = lazy(() => import('./pages/OfferDetails'));
const PdfTemplate = lazy(() => import('./pages/PdfTemplate'));
const InitialSetupPage = lazy(() => import('./pages/InitialSetupPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const MaterialImport = lazy(() => import('./pages/MaterialImport'));
const ClientImport = lazy(() => import('./pages/ClientImport'));
const EquipmentImport = lazy(() => import('./pages/EquipmentImport'));
const ClientDetails = lazy(() => import('./pages/ClientDetails'));
const SiteDetails = lazy(() => import('./pages/SiteDetails'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <CircularProgress size={40} thickness={3} />
  </Box>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppContent() {
  const { t } = useTranslation();
  const { data: bootstrapStatus, isLoading, isError } = useBootstrapStatus();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div>{t('app.serverConnectionError')}</div>
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        {bootstrapStatus?.initial_setup_required ? (
          <InitialSetupPage />
        ) : (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="service-requests" element={<ServiceRequests />} />
              <Route path="service-requests/new" element={<ServiceRequestCreate />} />
              <Route path="service-requests/:id" element={<ServiceRequestDetails />} />
              <Route path="offers" element={<Offers />} />
              <Route path="offers/:id/view" element={<OfferDetails />} />
              <Route path="offers/:id" element={<OfferEditor />} />
              <Route path="clients" element={<Clients />} />
              <Route path="clients/:clientId/sites/:siteId/equipment/import" element={<EquipmentImport />} />
              <Route path="clients/:clientId/sites/:siteId" element={<SiteDetails />} />
              <Route path="clients/:id" element={<ClientDetails />} />
              <Route path="clients/import" element={<ClientImport />} />
              <Route path="materials" element={<Materials />} />
              <Route path="materials/import" element={<MaterialImport />} />
              <Route path="materials/:id" element={<MaterialDetails />} />
              <Route path="users" element={<Users />} />
              <Route path="users/roles" element={<Navigate to="/users?section=roles" replace />} />
              <Route path="settings" element={<Settings />} />
              <Route path="pdf-template" element={<PdfTemplate />} />
            </Route>
          </Routes>
        )}
      </Suspense>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CssBaseline />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
