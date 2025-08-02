import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RootLayout } from "./components/layout/root-layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RouteGuard } from "./components/auth/RouteGuard";
import { SecurityMonitoringWrapper } from "./components/SecurityMonitoringWrapper";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SignupPage from "./pages/SignupPage";
import EmailConfirmationPage from "./pages/EmailConfirmationPage";
import PromptsPage from "./pages/PromptsPage";
import ChatGPTPromptsPage from "./pages/prompts/ChatGPTPromptsPage";
import MidjourneyPromptsPage from "./pages/prompts/MidjourneyPromptsPage";
import WorkflowPromptsPage from "./pages/prompts/WorkflowPromptsPage";
import FavoritesPage from "./pages/FavoritesPage";
import SearchPage from "./pages/SearchPage";
import PricingPage from "./pages/PricingPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentCallbackPage from "./pages/PaymentCallbackPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentFailedPage from "./pages/PaymentFailedPage";
import UserDashboardPage from "./pages/UserDashboardPage";
import SubscriptionDashboard from "./pages/dashboard/SubscriptionDashboard";
import PrompterDashboard from "./pages/prompter/PrompterDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PromptsManagement from "./pages/admin/PromptsManagement";
import PromptGeneratorPage from "./pages/PromptGeneratorPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import ExamplesPage from "./pages/ExamplesPage";
import NotFoundPage from "./pages/NotFoundPage";
import MagicLinkSentPage from "./pages/MagicLinkSentPage";
import UnsubscribePage from "./pages/UnsubscribePage";

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AuthProvider>
                <SecurityMonitoringWrapper>
                  <Routes>
                    <Route path="/" element={<RootLayout />}>
                      <Route index element={<Index />} />
                      <Route path="login" element={<LoginPage />} />
                      <Route path="reset-password" element={<ResetPasswordPage />} />
                      <Route path="signup" element={<SignupPage />} />
                      <Route path="magic-link-sent" element={<MagicLinkSentPage />} />
                      <Route path="unsubscribe" element={<UnsubscribePage />} />
                      <Route path="email-confirmation" element={<EmailConfirmationPage />} />
                      <Route path="examples" element={<ExamplesPage />} />
                      <Route path="prompts" element={<PromptsPage />} />
                      <Route path="prompts/chatgpt" element={<ChatGPTPromptsPage />} />
                      <Route path="prompts/midjourney" element={<MidjourneyPromptsPage />} />
                      <Route path="prompts/workflow" element={<WorkflowPromptsPage />} />
                      <Route path="favorites" element={<FavoritesPage />} />
                      <Route path="search" element={<SearchPage />} />
                      <Route path="pricing" element={<PricingPage />} />
                      <Route path="checkout" element={<CheckoutPage />} />
                      <Route path="payment/callback" element={<PaymentCallbackPage />} />
                      <Route path="payment-success" element={<PaymentSuccessPage />} />
                      <Route path="payment-failed" element={<PaymentFailedPage />} />
                      <Route path="dashboard" element={<ProtectedRoute><UserDashboardPage /></ProtectedRoute>} />
                      <Route path="dashboard/subscription" element={<ProtectedRoute><SubscriptionDashboard /></ProtectedRoute>} />
                      <Route path="dashboard/prompter" element={<RouteGuard requiredRole="prompter"><PrompterDashboard /></RouteGuard>} />
                      <Route path="prompter" element={<RouteGuard requiredRole="prompter"><PrompterDashboard /></RouteGuard>} />
                      <Route path="admin" element={<RouteGuard requiredRole="admin" fallbackRoute="/prompts"><AdminDashboard /></RouteGuard>} />
                      <Route path="admin/prompts" element={<RouteGuard requiredRole="admin" fallbackRoute="/prompts"><PromptsManagement /></RouteGuard>} />
                      <Route path="prompt-generator" element={<PromptGeneratorPage />} />
                      <Route path="about" element={<AboutPage />} />
                      <Route path="contact" element={<ContactPage />} />
                      <Route path="faq" element={<FAQPage />} />
                      <Route path="privacy" element={<PrivacyPolicyPage />} />
                      <Route path="terms" element={<TermsOfServicePage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Routes>
                  <Toaster />
                  <Sonner />
                </SecurityMonitoringWrapper>
              </AuthProvider>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;