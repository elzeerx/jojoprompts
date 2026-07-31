import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
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
import {
  AdminCompatibilityResolver,
  AdminWorkspacePage,
} from "./pages/admin/layout/AdminWorkspacePage";
import { V2Layout } from "./components/v2/V2Layout";
import { PublicRouteResolver } from "./components/v2/PublicRouteResolver";
import { isLaunchLocked } from "./config/siteMode";

const AdminLayout = lazy(() => import("./pages/admin/layout/AdminLayout"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));

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

function LockedApp() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<SuspenseLoader />}>
        <ComingSoonPage />
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  /* The production lock is absolute and intentionally returns before
     QueryClient, BrowserRouter, LanguageProvider, AuthProvider, OAuth, admin,
     or any public/customer route mounts. This keeps the locked site inert:
     no login/reset form, no existing-session refresh, no catalog/profile
     queries, and no customer or admin navigation. The exact private Lovable
     preview host is exempt in isLaunchLocked(), preserving the working QA
     surface. */
  if (isLaunchLocked()) {
    return <LockedApp />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
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

                          {/* Six primary admin workspaces. Operational detail
                              lives in workspace tabs or Content sub-tools so
                              Lovable no longer exposes dozens of faux pages. */}
                          <Route path="content/*" element={<AdminWorkspacePage workspace="content" />} />
                          <Route path="commerce" element={<AdminWorkspacePage workspace="commerce" />} />
                          <Route path="people" element={<AdminWorkspacePage workspace="people" />} />
                          <Route path="operations" element={<AdminWorkspacePage workspace="operations" />} />
                          <Route path="settings" element={<AdminWorkspacePage workspace="settings" />} />

                          {/* All previous admin bookmarks resolve here. */}
                          <Route path="*" element={<AdminCompatibilityResolver />} />
                      </Route>

                      {/* Canonical V2 public shell wraps every customer/
                          public/auth/legal/info route AND the 404 wildcard.
                          No legacy layout, no legacy Header/Footer,
                          no admin FloatingAddPromptButton on any customer
                          surface. */}
                      <Route element={<V2Layout />}>
                        {routes.map((route) => (
                          <Route
                            key={route.path}
                            path={route.path}
                            element={createGuardedRoute(route)}
                            index={route.index}
                          />
                        ))}

                        <Route path="*" element={<PublicRouteResolver />} />
                      </Route>
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
