
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardOverview } from "./components/DashboardOverview";
import { PromptsManagement } from "./PromptsManagement";
import { UsersManagement } from "./components/users/UsersManagement";
import { PurchaseHistoryManagement } from "./components/purchases/PurchaseHistoryManagement";
import { DiscountCodesManagement } from "./components/discount-codes/DiscountCodesManagement";
import { CategoriesManagement } from "./components/categories/CategoriesManagement";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your application settings and content
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="discounts">Discount Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          <PromptsManagement />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoriesManagement />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="purchases" className="space-y-6">
          <PurchaseHistoryManagement />
        </TabsContent>

        <TabsContent value="discounts" className="space-y-6">
          <DiscountCodesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
