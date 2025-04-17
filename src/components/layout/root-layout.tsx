
import { Outlet } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { Toaster } from "../ui/toaster";

interface RootLayoutProps {
  userRole?: string | null;
  userEmail?: string | null;
  onLogout?: () => void;
}

export function RootLayout({ userRole, userEmail, onLogout }: RootLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header userRole={userRole} userEmail={userEmail} onLogout={onLogout} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
