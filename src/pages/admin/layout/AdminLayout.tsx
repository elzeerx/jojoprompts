import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";
import { AdminCommandPalette, useAdminCommandPalette } from "./AdminCommandPalette";

const SIDEBAR_STORAGE_KEY = "admin:sidebar:open";

function readStoredSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export default function AdminLayout() {
  const { open: paletteOpen, setOpen: setPaletteOpen } = useAdminCommandPalette();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => readStoredSidebarOpen());

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="min-h-screen flex w-full bg-soft-bg/30">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <AdminTopBar onOpenCommandPalette={() => setPaletteOpen(true)} />
          <main className="flex-1 p-3 sm:p-5 lg:p-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 lg:p-6">
                <Outlet />
              </div>
            </div>
          </main>
        </SidebarInset>
        <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </SidebarProvider>
  );
}
