
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RootLayout } from "@/components/layout/root-layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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
import CollectionsPage from "@/pages/collections";

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import PrompterDashboard from "@/pages/prompter/PrompterDashboard";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="ui-theme">
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
              <Route path="privacy" element={<PrivacyPolicyPage />} />
              
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
                path="collections" 
                element={
                  <ProtectedRoute>
                    <CollectionsPage />
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
