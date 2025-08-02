
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Container } from "@/components/ui/container";
import DashboardOverview from "./components/DashboardOverview";
import PromptsManagement from "./PromptsManagement";
import UsersManagement from "./components/users/UsersManagement";
import PurchaseHistoryManagement from "./components/purchases/PurchaseHistoryManagement";
import DiscountCodesManagement from "./components/discount-codes/DiscountCodesManagement";
import { CategoriesManagement } from "./components/categories/CategoriesManagement";
import { SecurityMonitoringDashboard } from "@/components/admin/SecurityMonitoringDashboard";
import { EmailAnalyticsDashboard } from "@/components/admin/EmailAnalyticsDashboard";
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';
import { BarChart3, FileText, Tags, Users, CreditCard, Percent, Shield, Mail } from "lucide-react";
import { useAdminTabs } from "./hooks/useAdminTabs";
import { MobileTabsList } from "./components/navigation/MobileTabsList";
import { DesktopTabsList } from "./components/navigation/DesktopTabsList";

export default function AdminDashboard() {
  const { adminTabs, activeTab, setActiveTab } = useAdminTabs();
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

  // Add security tab to existing tabs with proper interface compliance
  const enhancedTabs = [
    ...adminTabs,
    {
      id: "security",
      label: "Security",
      icon: Shield,
      mobileLabel: "Security"
    }
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
              <MobileTabsList tabs={enhancedTabs} isSmallMobile={isSmallMobile} />
            ) : (
              <DesktopTabsList tabs={enhancedTabs} />
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
            <TabsContent value="emails" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <EmailAnalyticsDashboard />
            </TabsContent>
            <TabsContent value="security" className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6 m-0">
              <SecurityMonitoringDashboard />
            </TabsContent>
          </div>
        </Tabs>
      </Container>
    </div>
  );
}
