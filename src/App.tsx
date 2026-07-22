import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

const V2_PATHS = new Set([
  "explore",
  "skills",
  "automations",
  "prompts-catalog",
  "image-styles",
  "bundles",
  "resources/:slug",
  "library",
]);
import { V2Layout } from "./components/v2/V2Layout";


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

                        {/* Admin — dedicated shell, no public Header/Footer/FloatingButton */}
                        <Route
                          path="/admin"
                          element={
                            <AdminGuard fallbackRoute="/prompts">
                              <AdminLayout />
                            </AdminGuard>
                          }
                        >
                          <Route index element={adminSectionElements.overview} />

                          {/* Catalog */}
                          <Route path="catalog" element={adminSectionElements.catalog} />
                          <Route path="catalog/skills" element={adminSectionElements.catalogSkills} />
                          <Route path="catalog/automations" element={adminSectionElements.catalogAutomations} />
                          <Route path="catalog/prompts" element={adminSectionElements.catalogPrompts} />
                          <Route path="catalog/image-styles" element={adminSectionElements.catalogImageStyles} />
                          <Route path="catalog/bundles" element={adminSectionElements.catalogBundles} />

                          {/* Publishing */}
                          <Route path="publishing/drafts" element={adminSectionElements.publishingDrafts} />
                          <Route path="publishing/review" element={adminSectionElements.publishingReview} />
                          <Route path="publishing/versions" element={adminSectionElements.publishingVersions} />
                          <Route path="publishing/imports" element={adminSectionElements.publishingImports} />
                          <Route path="publishing/imports/json" element={adminSectionElements.publishingImportsJson} />
                          <Route path="publishing/imports/ai-studio" element={adminSectionElements.publishingImportsAiStudio} />
                          <Route path="publishing/imports/ai-studio/:draftId" element={adminSectionElements.publishingImportsAiStudio} />
                          <Route path="publishing/taxonomy" element={adminSectionElements.publishingTaxonomy} />

                          {/* Orders */}
                          <Route path="orders" element={adminSectionElements.orders} />
                          <Route path="orders/payment-events" element={adminSectionElements.paymentEvents} />
                          <Route path="orders/entitlements" element={adminSectionElements.entitlements} />
                          <Route path="orders/refunds" element={adminSectionElements.refunds} />
                          <Route path="orders/recovery" element={adminSectionElements.ordersRecovery} />
                          <Route path="orders/discounts" element={adminSectionElements.discounts} />

                          {/* People */}
                          <Route path="users" element={adminSectionElements.users} />

                          {/* Communications */}
                          <Route path="communications/templates" element={adminSectionElements.emailTemplates} />
                          <Route path="communications/delivery" element={adminSectionElements.emailAnalytics} />

                          {/* Trust & Activity */}
                          <Route path="trust/reports" element={adminSectionElements.trustReports} />
                          <Route path="trust/scans" element={adminSectionElements.trustScans} />
                          <Route path="trust/admin-activity" element={adminSectionElements.audit} />
                          <Route path="trust/security-events" element={adminSectionElements.security} />

                          {/* Settings */}
                          <Route path="settings/payments" element={adminSectionElements.settingsPayments} />
                          <Route path="settings/email" element={adminSectionElements.settingsEmail} />
                          <Route path="settings/storage" element={adminSectionElements.settingsStorage} />
                          <Route path="settings/integrations" element={adminSectionElements.settingsIntegrations} />
                          <Route path="settings/roles" element={adminSectionElements.settingsRoles} />

                          {/* Legacy path redirects */}
                          <Route path="analytics" element={<Navigate to="/admin" replace />} />
                          <Route path="prompts" element={<Navigate to="/admin/catalog/prompts" replace />} />
                          <Route path="prompts/import" element={<Navigate to="/admin/publishing/imports" replace />} />
                          <Route path="ai-studio" element={<Navigate to="/admin/publishing/imports/ai-studio" replace />} />
                          <Route path="ai-studio/:draftId" element={<Navigate to="/admin/publishing/imports/ai-studio" replace />} />
                          <Route path="categories" element={<Navigate to="/admin/publishing/taxonomy" replace />} />
                          <Route path="purchases" element={<Navigate to="/admin/orders" replace />} />
                          <Route path="abandoned-cart" element={<Navigate to="/admin/orders/recovery" replace />} />
                          <Route path="emails" element={<Navigate to="/admin/communications/templates" replace />} />
                          <Route path="emails/templates" element={<Navigate to="/admin/communications/templates" replace />} />
                          <Route path="emails/analytics" element={<Navigate to="/admin/communications/delivery" replace />} />
                          <Route path="emails/marketing" element={<Navigate to="/admin/communications/templates" replace />} />
                          <Route path="security" element={<Navigate to="/admin/trust/security-events" replace />} />
                          <Route path="audit" element={<Navigate to="/admin/trust/admin-activity" replace />} />
                        </Route>

                        {/* Public routes under RootLayout (Header/Footer/etc.) */}
                        <Route path="/" element={<RootLayout />}>
                          <Route element={<V2Layout />}>
                            {routes.filter((r) => V2_PATHS.has(r.path)).map((route) => (
                              <Route
                                key={route.path}
                                path={route.path}
                                element={createGuardedRoute(route)}
                                index={route.index}
                              />
                            ))}
                          </Route>

                          {routes.filter((r) => !V2_PATHS.has(r.path)).map((route) => (
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