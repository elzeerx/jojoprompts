
import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RootLayout } from "@/components/layout/root-layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { initializeSecurity } from "@/utils/securityHeaders";

// Pages
import Index from "@/pages/Index";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import PricingPage from "@/pages/PricingPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import FAQPage from "@/pages/FAQPage";
import SearchPage from "@/pages/SearchPage";
import NotFoundPage from "@/pages/NotFoundPage";
import UserDashboardPage from "@/pages/UserDashboardPage";
import PromptsPage from "@/pages/PromptsPage";
import ChatGPTPromptsPage from "@/pages/prompts/ChatGPTPromptsPage";
import MidjourneyPromptsPage from "@/pages/prompts/MidjourneyPromptsPage";
import WorkflowPromptsPage from "@/pages/prompts/WorkflowPromptsPage";
import FavoritesPage from "@/pages/FavoritesPage";
import CheckoutPage from "@/pages/CheckoutPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import PrompterDashboard from "@/pages/prompter/PrompterDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  useEffect(() => {
    // Initialize security measures
    initializeSecurity();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootLayout />}>
            <Route index element={<Index />} />
            <Route path="home" element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="faq" element={<FAQPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="terms" element={<TermsOfServicePage />} />
            <Route path="terms-of-service" element={<TermsOfServicePage />} />
            <Route path="privacy" element={<PrivacyPolicyPage />} />
            <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
            
            {/* Protected Routes */}
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute>
                  <UserDashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="prompts" 
              element={
                <ProtectedRoute>
                  <PromptsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="prompts/chatgpt" 
              element={
                <ProtectedRoute>
                  <ChatGPTPromptsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="prompts/midjourney" 
              element={
                <ProtectedRoute>
                  <MidjourneyPromptsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="prompts/workflows" 
              element={
                <ProtectedRoute>
                  <WorkflowPromptsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="favorites" 
              element={
                <ProtectedRoute>
                  <FavoritesPage />
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
            <Route 
              path="payment-success" 
              element={
                <ProtectedRoute>
                  <PaymentSuccessPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="admin/*" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Prompter Routes */}
            <Route 
              path="prompter" 
              element={
                <ProtectedRoute>
                  <PrompterDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
