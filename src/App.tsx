import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RoleGuard, AdminGuard } from "./components/auth/Guard";
// SecurityMonitoringWrapper removed pre-launch: no active browser client
// should INSERT into public.security_logs. Server-side/admin activity
// logging still happens via Edge Functions and DB triggers.
import { routes } from "./config/routes";
import { adminSectionElements } from "./pages/admin/layout/adminSectionElements";
import { V2Layout } from "./components/v2/V2Layout";
import { isLaunchLocked } from "./config/siteMode";

const AdminLayout = lazy(() => import("./pages/admin/layout/AdminLayout"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

const queryClient = new QueryClient();

const SuspenseLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
      <p>Loading...</p>
    </div>
  </div>
);

/**
 * Wrap a route component with the appropriate guard. `premium` protection
 * has been removed from V2 — acquisition is entitlement-based. Any legacy
 * `premium` protection value degrades to unguarded public rendering.
 */
const createGuardedRoute = (route: typeof routes[0]) => {
  const Component = route.component;

  switch (route.protection) {
    case "role":
      if (route.requiredRole) {
        return (
          <RoleGuard role={route.requiredRole}>
            <Component />
          </RoleGuard>
        );
      }
      return <Component />;
    case "admin":
      return (
        <AdminGuard fallbackRoute={route.fallbackRoute}>
          <Component />
        </AdminGuard>
      );
    default:
      return <Component />;
  }
};

/**
 * Explicit V1 → V2 client-side compatibility redirects. Fixed destinations
 * only; we intentionally do NOT forward arbitrary query parameters from
 * legacy URLs to avoid open-redirect / parameter-smuggling risks.
 */
const LEGACY_REDIRECTS: ReadonlyArray<readonly [string, string]> = [
  // /prompts-catalog is the legacy compatibility path; /prompts is
  // canonical (see routes.ts). PromptsCatalogRedirect below preserves
  // the incoming ?query and #hash so filters/state survive the hop.
  ["prompts/chatgpt", "/prompts?platform=chatgpt"],
  ["prompts/midjourney", "/image-styles"],
  ["prompts/workflow", "/automations"],
  ["prompts/gpts-builder", "/skills"],
  ["favorites", "/library"],
  ["payment-dashboard", "/orders"],
  ["dashboard", "/account"],
  ["dashboard/subscription", "/account"],
  ["payment-success", "/orders"],
  ["payment-failed", "/orders"],
  ["payment-recovery", "/orders"],
  ["dashboard/prompter", "/explore"],
  ["prompter", "/explore"],
  ["examples", "/explore"],
  ["search", "/explore"],
  ["demo/enhanced-prompt", "/explore"],
];

/**
 * /prompts-catalog → /prompts, preserving query string and hash so users
 * (and bookmarks/back-navigations) keep filters like ?platform=chatgpt.
 */
function PromptsCatalogRedirect() {
  if (typeof window === "undefined") {
    return <Navigate to="/prompts" replace />;
  }
  const { search, hash } = window.location;
  return <Navigate to={`/prompts${search}${hash}`} replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <LanguageProvider>
                <AuthProvider>
                  <Suspense fallback={<SuspenseLoader />}>
                    <Routes>
                      {/* MCP OAuth consent — standalone, outside any chrome */}
                        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

                        {/* Admin — dedicated shell, no customer chrome */}
                        <Route
                          path="/admin"
                          element={
                            <AdminGuard fallbackRoute="/">
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
                          <Route path="catalog/prompt-packs" element={adminSectionElements.catalogPromptPacks} />

                          {/* Publishing */}
                          <Route path="publishing/new" element={adminSectionElements.publishingNew} />
                          <Route path="publishing/resources/:resourceId/edit" element={adminSectionElements.publishingEdit} />
                          <Route path="publishing/resources/:resourceId/versions/new" element={adminSectionElements.publishingNewVersion} />
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

                          {/* Legacy admin path redirects */}
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

                        {isLaunchLocked() ? (
                          <>
                            {/* Admin-only sign-in surface remains reachable so
                                admins can authenticate into /admin/**. Signup
                                UI is stripped from LoginForm while locked. */}
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                            {/* Everything else — including /signup, /library,
                                /checkout, /pricing, resource deep links, and
                                legacy prompt routes — is Coming Soon. */}
                            <Route path="*" element={<ComingSoonPage />} />
                          </>
                        ) : (
                          /* Canonical V2 public shell wraps every customer/
                             public/auth/legal/info route AND the 404 wildcard.
                             No legacy layout, no legacy Header/Footer,
                             no admin FloatingAddPromptButton on any customer
                             surface. */
                          <Route element={<V2Layout />}>
                            {routes.map((route) => (
                              <Route
                                key={route.path}
                                path={route.path}
                                element={createGuardedRoute(route)}
                                index={route.index}
                              />
                            ))}

                            {LEGACY_REDIRECTS.map(([from, to]) => (
                              <Route
                                key={`redirect:${from}`}
                                path={from}
                                element={<Navigate to={to} replace />}
                              />
                            ))}
                          </Route>
                        )}
                    </Routes>
                  </Suspense>
                  <Toaster />
                  <Sonner />
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
