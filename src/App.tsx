import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { RootLayout } from "./components/layout/root-layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthPremiumGuard, RoleGuard, AdminGuard } from "./components/auth/Guard";
import { SecurityMonitoringWrapper } from "./components/SecurityMonitoringWrapper";
import { routes } from "./config/routes";
import { adminSectionElements } from "./pages/admin/layout/adminSectionElements";

const AdminLayout = lazy(() => import("./pages/admin/layout/AdminLayout"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

// Loading component for suspense fallback
const SuspenseLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
      <p>Loading...</p>
    </div>
  </div>
);

// Helper function to wrap component with appropriate guard
const createGuardedRoute = (route: typeof routes[0]) => {
  const Component = route.component;
  
  switch (route.protection) {
    case 'premium':
      return (
        <AuthPremiumGuard>
          <Component />
        </AuthPremiumGuard>
      );
    case 'role':
      if (route.requiredRole) {
        return (
          <RoleGuard role={route.requiredRole}>
            <Component />
          </RoleGuard>
        );
      }
      return <Component />;
    case 'admin':
      return (
        <AdminGuard fallbackRoute={route.fallbackRoute}>
          <Component />
        </AdminGuard>
      );
    default:
      return <Component />;
  }
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <LanguageProvider>
                <AuthProvider>
                  <SecurityMonitoringWrapper>
                    <Suspense fallback={<SuspenseLoader />}>
                      <Routes>
                        {/* MCP OAuth consent — standalone, outside RootLayout chrome */}
                        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                        <Route path="/" element={<RootLayout />}>
                          {/* Nested admin routes with sidebar layout */}
                          <Route
                            path="admin"
                            element={
                              <AdminGuard fallbackRoute="/prompts">
                                <AdminLayout />
                              </AdminGuard>
                            }
                          >
                            <Route index element={adminSectionElements.overview} />
                            <Route path="analytics" element={adminSectionElements.analytics} />
                            <Route path="prompts" element={adminSectionElements.prompts} />
                            <Route path="prompts/import" element={adminSectionElements.promptsImport} />
                            <Route path="categories" element={adminSectionElements.categories} />
                            <Route path="users" element={adminSectionElements.users} />
                            <Route path="purchases" element={adminSectionElements.purchases} />
                            <Route path="discounts" element={adminSectionElements.discounts} />
                            <Route path="abandoned-cart" element={adminSectionElements.abandonedCart} />
                            <Route path="emails" element={adminSectionElements.communications}>
                              <Route index element={adminSectionElements.emailTemplates} />
                              <Route path="templates" element={adminSectionElements.emailTemplates} />
                              <Route path="analytics" element={adminSectionElements.emailAnalytics} />
                              <Route path="marketing" element={adminSectionElements.marketing} />
                            </Route>
                            <Route path="security" element={adminSectionElements.security} />
                            <Route path="audit" element={adminSectionElements.audit} />
                            <Route path="ai-studio" element={adminSectionElements.aiStudio} />
                            <Route path="ai-studio/:draftId" element={adminSectionElements.aiStudio} />
                          </Route>

                          {routes.map((route) => (
                            <Route
                              key={route.path}
                              path={route.path}
                              element={createGuardedRoute(route)}
                              index={route.index}
                            />
                          ))}
                        </Route>
                      </Routes>
                    </Suspense>
                    <Toaster />
                    <Sonner />
                  </SecurityMonitoringWrapper>
                </AuthProvider>
              </LanguageProvider>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;