import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import { RootLayout } from "./components/layout/root-layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthPremiumGuard, RoleGuard, AdminGuard } from "./components/auth/Guard";
import { SecurityMonitoringWrapper } from "./components/SecurityMonitoringWrapper";
import { routes } from "./config/routes";

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
              <AuthProvider>
                <SecurityMonitoringWrapper>
                  <Suspense fallback={<SuspenseLoader />}>
                    <Routes>
                      <Route path="/" element={<RootLayout />}>
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
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;