
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { RootLayout } from "@/components/layout/root-layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthErrorBoundary } from "@/components/auth/AuthErrorBoundary";

// Page imports
import Index from "@/pages/Index";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import PromptsPage from "@/pages/PromptsPage";
import ChatGPTPromptsPage from "@/pages/prompts/ChatGPTPromptsPage";
import MidjourneyPromptsPage from "@/pages/prompts/MidjourneyPromptsPage";
import WorkflowPromptsPage from "@/pages/prompts/WorkflowPromptsPage";
import SearchPage from "@/pages/SearchPage";
import FavoritesPage from "@/pages/FavoritesPage";
import PricingPage from "@/pages/PricingPage";
import CheckoutPage from "@/pages/CheckoutPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import PaymentFailedPage from "@/pages/PaymentFailedPage";
import PaymentCallbackPage from "@/pages/PaymentCallbackPage";
import UserDashboardPage from "@/pages/UserDashboardPage";
import SubscriptionDashboard from "@/pages/dashboard/SubscriptionDashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import PrompterDashboard from "@/pages/prompter/PrompterDashboard";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import FAQPage from "@/pages/FAQPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import NotFoundPage from "@/pages/NotFoundPage";

import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <Router>
          <AuthErrorBoundary>
            <AuthProvider>
              <RootLayout>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/prompts" element={<PromptsPage />} />
                  <Route path="/prompts/chatgpt" element={<ChatGPTPromptsPage />} />
                  <Route path="/prompts/midjourney" element={<MidjourneyPromptsPage />} />
                  <Route path="/prompts/workflows" element={<WorkflowPromptsPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsOfServicePage />} />

                  {/* Protected routes */}
                  <Route
                    path="/favorites"
                    element={
                      <ProtectedRoute>
                        <FavoritesPage />
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

                  {/* Admin-only routes */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Prompter dashboard route */}
                  <Route
                    path="/prompter-dashboard"
                    element={
                      <ProtectedRoute>
                        <PrompterDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Payment routes */}
                  <Route path="/payment/success" element={<PaymentSuccessPage />} />
                  <Route path="/payment/failed" element={<PaymentFailedPage />} />
                  <Route path="/payment/callback" element={<PaymentCallbackPage />} />

                  {/* 404 route */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </RootLayout>
            </AuthProvider>
          </AuthErrorBoundary>
        </Router>
        <Toaster />
        <SonnerToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
