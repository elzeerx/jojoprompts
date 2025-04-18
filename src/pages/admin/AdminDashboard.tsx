
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import PromptsManagement from "./PromptsManagement";
import DashboardOverview from "./components/DashboardOverview";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [favoritedPromptIds, setFavoritedPromptIds] = useState<string[]>([]);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from("favorites")
          .select("prompt_id")
          .eq("user_id", user.id);
          
        setFavoritedPromptIds(data?.map(item => item.prompt_id) || []);
      } catch (error) {
        console.error("Error fetching favorites:", error);
      }
    };
    
    fetchFavorites();
  }, [user]);
  
  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage prompts, users, and run AI helpers
          </p>
        </div>
      </div>
      
      <Tabs 
        defaultValue="overview" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="ai">AI Helpers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <DashboardOverview />
        </TabsContent>
        
        <TabsContent value="prompts">
          <PromptsManagement favoritedPromptIds={favoritedPromptIds} />
        </TabsContent>
        
        <TabsContent value="users">
          <div className="rounded-lg border shadow-sm">
            <div className="p-6">
              <h3 className="text-lg font-medium">User Management</h3>
              <p className="text-muted-foreground">
                This will be implemented with Supabase authentication
              </p>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="ai">
          <div className="rounded-lg border shadow-sm">
            <div className="p-6">
              <h3 className="text-lg font-medium">AI Helpers</h3>
              <p className="text-muted-foreground">
                AI helper features will be implemented here
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
