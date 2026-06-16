import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

export default function AdminLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-soft-bg/30">
        <AdminSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <AdminTopBar />
          <main className="flex-1 p-3 sm:p-5 lg:p-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 lg:p-6">
                <Outlet />
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
