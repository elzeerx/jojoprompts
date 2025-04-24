
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { useAuth } from "@/contexts/AuthContext";
import { FloatingAddPromptButton } from "../ui/FloatingAddPromptButton";

export function RootLayout() {
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <Header userEmail={user?.email} userRole={userRole} onLogout={signOut} />
      <main className="flex-1 relative">
        <Outlet />
        {location.pathname !== "/" && <FloatingAddPromptButton />}
      </main>
      <Footer />
    </div>
  );
}
