
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner"

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RootLayout } from './components/layout/RootLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import UserDashboardPage from './pages/UserDashboardPage';
import PromptsPage from './pages/prompts/PromptsPage';
import FavoritesPage from './pages/FavoritesPage';
import LoginPage from './pages/LoginPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import PaymentHistoryPage from './pages/PaymentHistoryPage';
import ContactPage from './pages/ContactPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import NotFoundPage from './pages/NotFoundPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PromptsManagement from './pages/admin/PromptsManagement';
import PaymentHandler from "./pages/PaymentHandler";
import TestingDashboard from './pages/TestingDashboard';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/pricing" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootLayout />}>
              <Route index element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="prompts" element={<PromptsPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="terms-of-service" element={<TermsOfServicePage />} />
              <Route path="payment-history" element={<PaymentHistoryPage />} />
              <Route
                path="favorites"
                element={
                  <ProtectedRoute>
                    <FavoritesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute>
                    <UserDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="checkout"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/prompts"
                element={
                  <AdminRoute>
                    <PromptsManagement />
                  </AdminRoute>
                }
              />
              <Route
                path="admin/testing"
                element={
                  <AdminRoute>
                    <TestingDashboard />
                  </AdminRoute>
                }
              />
            </Route>
            
            {/* Payment routes outside of RootLayout for full-screen experience */}
            <Route path="/payment-handler" element={<PaymentHandler />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/failed" element={<PaymentFailedPage />} />
            
            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
