
import { Outlet } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { useAuth } from "@/contexts/AuthContext";

export function RootLayout() {
  const { user, userRole, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header userEmail={user?.email} userRole={userRole} onLogout={signOut} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
