import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useBootstrapStatus } from './hooks/useBootstrapStatus';
import { CircularProgress, Box } from '@mui/material';

// Layout and identity pages stay eager because they are small and needed immediately.
import Layout from './components/Layout';
import Login from './pages/Login';

// All other pages are lazy loaded.
const Clients = lazy(() => import('./pages/Clients'));
const Materials = lazy(() => import('./pages/Materials'));
const MaterialDetails = lazy(() => import('./pages/MaterialDetails'));
const ServiceRequests = lazy(() => import('./pages/ServiceRequests'));
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
const ClientDetails = lazy(() => import('./pages/ClientDetails'));

// Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Page loader spinner
const PageLoader = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <CircularProgress size={40} thickness={3} />
  </Box>
);

// Route guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

// Core app router
function AppContent() {
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
        <div>Грешка при свързване със сървъра</div>
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
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with shared Layout */}
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
              <Route path="service-requests/:id" element={<ServiceRequestDetails />} />
              <Route path="offers" element={<Offers />} />
              <Route path="offers/:id/view" element={<OfferDetails />} />
              <Route path="offers/:id" element={<OfferEditor />} />
              <Route path="clients" element={<Clients />} />
              <Route path="clients/:id" element={<ClientDetails />} />
              <Route path="clients/import" element={<ClientImport />} />
              <Route path="materials" element={<Materials />} />
              <Route path="materials/import" element={<MaterialImport />} />
              <Route path="materials/:id" element={<MaterialDetails />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
              <Route path="pdf-template" element={<PdfTemplate />} />
            </Route>
          </Routes>
        )}
      </Suspense>
    </BrowserRouter>
  );
}

// Root
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
