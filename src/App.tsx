import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner"

import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import DashboardPage from './pages/DashboardPage';
import PromptsPage from './pages/PromptsPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import ContactPage from './pages/ContactPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentFailedPage from './pages/PaymentFailedPage';
import PaymentHistoryPage from './pages/PaymentHistoryPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPromptsPage from './pages/admin/AdminPromptsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import CreatePromptPage from './pages/admin/CreatePromptPage';
import EditPromptPage from './pages/admin/EditPromptPage';
import CategoryDetailsPage from './pages/admin/CategoryDetailsPage';
import DiscountCodesPage from './pages/admin/DiscountCodesPage';
import DiscountCodeDetailsPage from './pages/admin/DiscountCodeDetailsPage';
import PaymentHandler from "./pages/PaymentHandler";

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/prompts" element={<PromptsPage />} />
            <Route path="/payment-history" element={<PaymentHistoryPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account-settings"
              element={
                <ProtectedRoute>
                  <AccountSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/prompts"
              element={
                <AdminRoute>
                  <AdminPromptsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/prompts/create"
              element={
                <AdminRoute>
                  <CreatePromptPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/prompts/:id/edit"
              element={
                <AdminRoute>
                  <EditPromptPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <AdminRoute>
                  <AdminCategoriesPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/categories/:id"
              element={
                <AdminRoute>
                  <CategoryDetailsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/payments"
              element={
                <AdminRoute>
                  <AdminPaymentsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/discount-codes"
              element={
                <AdminRoute>
                  <DiscountCodesPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/discount-codes/:id"
              element={
                <AdminRoute>
                  <DiscountCodeDetailsPage />
                </AdminRoute>
              }
            />
            
            {/* Payment routes */}
            <Route path="/payment-handler" element={<PaymentHandler />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/failed" element={<PaymentFailedPage />} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/pricing" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default App;
