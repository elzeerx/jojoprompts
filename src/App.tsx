
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { RootLayout } from "./components/layout/root-layout";
import { AuthProvider } from "./contexts/AuthContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFoundPage from "./pages/NotFoundPage";
import AboutPage from "./pages/AboutPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import FavoritesPage from "./pages/FavoritesPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import SubscriptionDashboard from "./pages/dashboard/SubscriptionDashboard";
import PricingPage from "./pages/PricingPage";
import UserDashboardPage from "./pages/UserDashboardPage";

// Import prompt pages
import PromptsPage from "./pages/prompts/PromptsPage";
import ChatGPTPromptsPage from "./pages/prompts/ChatGPTPromptsPage";
import MidjourneyPromptsPage from "./pages/prompts/MidjourneyPromptsPage";
import WorkflowPromptsPage from "./pages/prompts/WorkflowPromptsPage";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route element={<RootLayout />}>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-service" element={<TermsOfServicePage />} />
              
              {/* Redirect reset-password to login page with reset tab */}
              <Route 
                path="/reset-password" 
                element={<Navigate to="/login?tab=reset" replace />} 
              />

              {/* Checkout page - public but manages authentication flow */}
              <Route path="/checkout" element={<CheckoutPage />} />

              {/* Protected routes */}
              <Route
                path="/prompts"
                element={
                  <ProtectedRoute>
                    <PromptsPage />
                  </ProtectedRoute>
                }
              />
              
              {/* Category-specific prompt pages */}
              <Route
                path="/prompts/chatgpt"
                element={
                  <ProtectedRoute>
                    <ChatGPTPromptsPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/prompts/midjourney"
                element={
                  <ProtectedRoute>
                    <MidjourneyPromptsPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/prompts/workflows"
                element={
                  <ProtectedRoute>
                    <WorkflowPromptsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/payment-success"
                element={
                  <ProtectedRoute>
                    <PaymentSuccessPage />
                  </ProtectedRoute>
                }
              />

              {/* Dashboard routes - both should work */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <UserDashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/subscription-dashboard"
                element={
                  <ProtectedRoute>
                    <SubscriptionDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/favorites"
                element={
                  <ProtectedRoute>
                    <FavoritesPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin dashboard (admin only) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
