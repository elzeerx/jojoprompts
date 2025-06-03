
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Container } from "@/components/ui/container";
import DashboardOverview from "./components/DashboardOverview";
import PromptsManagement from "./PromptsManagement";
import UsersManagement from "./components/users/UsersManagement";
import PurchaseHistoryManagement from "./components/purchases/PurchaseHistoryManagement";
import DiscountCodesManagement from "./components/discount-codes/DiscountCodesManagement";
import { CategoriesManagement } from "./components/categories/CategoriesManagement";
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';
import { BarChart3, FileText, Tags, Users, CreditCard, Percent } from "lucide-react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3, mobileLabel: "Home" },
    { id: "prompts", label: "Prompts", icon: FileText, mobileLabel: "Prompts" },
    { id: "categories", label: "Categories", icon: Tags, mobileLabel: "Tags" },
    { id: "users", label: "Users", icon: Users, mobileLabel: "Users" },
    { id: "purchases", label: "Purchases", icon: CreditCard, mobileLabel: "Sales" },
    { id: "discounts", label: "Discounts", icon: Percent, mobileLabel: "Codes" }
  ];

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-4 sm:py-6 lg:py-8">
        {/* Mobile-optimized header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="section-title text-xl sm:text-2xl lg:text-3xl">Admin Dashboard</h1>
          <p className="text-muted-foreground text-xs sm:text-sm lg:text-base mt-1 sm:mt-2">
            Manage your application settings and content
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile-first tab navigation */}
          <div className="mb-4 sm:mb-6">
            {isMobile ? (
              // Mobile: Horizontal scrolling tabs
              <div className="relative">
                <TabsList className="mobile-tabs w-full h-auto bg-white/80 backdrop-blur-sm border border-gray-200 p-1 grid grid-cols-3 sm:grid-cols-6 gap-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="mobile-tab data-[state=active]:mobile-tab-active data-[state=inactive]:mobile-tab-inactive flex flex-col items-center gap-1 px-2 py-2 text-xs min-h-[60px]"
                      >
                        <Icon className="h-3 w-3" />
                        <span className="leading-tight text-center">
                          {isSmallMobile ? tab.mobileLabel : tab.label}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            ) : (
              // Desktop: Standard horizontal tabs
              <TabsList className="w-full justify-start bg-white/80 backdrop-blur-sm border border-gray-200 h-auto p-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="data-[state=active]:bg-warm-gold data-[state=active]:text-white data-[state=inactive]:hover:bg-gray-100 text-sm px-4 py-3 flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            )}
          </div>

          {/* Mobile-optimized tab content container */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mobile-optimize-rendering">
            <TabsContent value="overview" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <DashboardOverview />
            </TabsContent>

            <TabsContent value="prompts" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <PromptsManagement />
            </TabsContent>

            <TabsContent value="categories" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <CategoriesManagement />
            </TabsContent>

            <TabsContent value="users" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <UsersManagement />
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <PurchaseHistoryManagement />
            </TabsContent>

            <TabsContent value="discounts" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <DiscountCodesManagement />
            </TabsContent>
          </div>
        </Tabs>
      </Container>
    </div>
  );
}
