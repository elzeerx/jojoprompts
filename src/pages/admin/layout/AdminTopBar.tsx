import { useLocation, Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { findAdminNavItem } from "../config/adminNavConfig";
import { ChevronRight } from "lucide-react";

export function AdminTopBar() {
  const { pathname } = useLocation();
  const current = findAdminNavItem(pathname);
  const title = current?.label ?? "Admin";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 backdrop-blur px-3 sm:px-5">
      <SidebarTrigger className="text-muted-foreground hover:text-dark-base" />
      <div className="h-5 w-px bg-gray-200" />
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
        <Link to="/admin" className="hover:text-dark-base transition-colors">
          Admin
        </Link>
        {current && current.to !== "/admin" && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-dark-base font-medium truncate">{title}</span>
          </>
        )}
      </nav>
    </header>
  );
}
