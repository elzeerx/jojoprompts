
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Container } from "@/components/ui/container";
import DashboardOverview from "./components/DashboardOverview";
import PromptsManagement from "./PromptsManagement";
import UsersManagement from "./components/users/UsersManagement";
import PurchaseHistoryManagement from "./components/purchases/PurchaseHistoryManagement";
import DiscountCodesManagement from "./components/discount-codes/DiscountCodesManagement";
import { CategoriesManagement } from "./components/categories/CategoriesManagement";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "prompts", label: "Prompts" },
    { id: "categories", label: "Categories" },
    { id: "users", label: "Users" },
    { id: "purchases", label: "Purchases" },
    { id: "discounts", label: "Discounts" }
  ];

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your application settings and content
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile-optimized tab navigation */}
          <div className="mb-6">
            <TabsList className="mobile-tabs w-full justify-start bg-white/80 backdrop-blur-sm border border-gray-200 h-auto">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="mobile-tab data-[state=active]:mobile-tab-active data-[state=inactive]:mobile-tab-inactive text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-3"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <TabsContent value="overview" className="space-y-6 p-4 sm:p-6 m-0">
              <DashboardOverview />
            </TabsContent>

            <TabsContent value="prompts" className="space-y-6 p-4 sm:p-6 m-0">
              <PromptsManagement />
            </TabsContent>

            <TabsContent value="categories" className="space-y-6 p-4 sm:p-6 m-0">
              <CategoriesManagement />
            </TabsContent>

            <TabsContent value="users" className="space-y-6 p-4 sm:p-6 m-0">
              <UsersManagement />
            </TabsContent>

            <TabsContent value="purchases" className="space-y-6 p-4 sm:p-6 m-0">
              <PurchaseHistoryManagement />
            </TabsContent>

            <TabsContent value="discounts" className="space-y-6 p-4 sm:p-6 m-0">
              <DiscountCodesManagement />
            </TabsContent>
          </div>
        </Tabs>
      </Container>
    </div>
  );
}
