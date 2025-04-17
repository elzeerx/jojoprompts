import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { RootLayout } from "./components/layout/root-layout";
import HomePage from "./pages/HomePage";
import PromptsPage from "./pages/PromptsPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFoundPage from "./pages/NotFoundPage";
import AboutPage from "./pages/AboutPage";

// Create a QueryClient for React Query
const queryClient = new QueryClient();

const App = () => {
  // Temporary auth state - will be replaced with Supabase auth
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  
  // Simulate logout
  const handleLogout = () => {
    setUser(null);
  };
  
  // Temporary login - for demo purposes only
  const handleTemporaryLogin = (email: string, role: "user" | "admin" = "user") => {
    setUser({ email, role });
  };
  
  // Check if user is authenticated and has the required role
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route 
              element={
                <RootLayout 
                  userEmail={user?.email} 
                  userRole={user?.role} 
                  onLogout={handleLogout} 
                />
              }
            >
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/prompts" element={<PromptsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/about" element={<AboutPage />} />
              
              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  isAuthenticated ? (
                    <DashboardPage />
                  ) : (
                    // Temporary auto-login for demo purposes
                    <LoginPage />
                  )
                } 
              />
              
              {/* Admin routes */}
              <Route 
                path="/admin/*" 
                element={
                  isAuthenticated && isAdmin ? (
                    <AdminDashboard />
                  ) : (
                    // Temporary auto-login as admin for demo
                    <LoginPage />
                  )
                } 
              />
              
              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
