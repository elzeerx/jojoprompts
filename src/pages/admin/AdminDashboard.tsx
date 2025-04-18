
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PromptsManagement from "./PromptsManagement";
import DashboardOverview from "./components/DashboardOverview";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [favoritedPromptIds, setFavoritedPromptIds] = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
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
          <div className="grid gap-6 md:grid-cols-2">
            {/* Generate Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Metadata</CardTitle>
                <CardDescription>
                  Analyze prompt text to generate category, style, and tags
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  disabled={loadingMeta}
                  onClick={async () => {
                    setLoadingMeta(true);
                    const { data, error } = await supabase.functions.invoke(
                      "generate-metadata",
                      { body: { } }
                    );
                    setLoadingMeta(false);
                    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                    else toast({ title: "Success", description: "Metadata generated!" });
                  }}
                >
                  {loadingMeta ? "Running…" : <><Zap className="mr-2 w-4 h-4" />Run</>}
                </Button>
              </CardContent>
            </Card>

            {/* Suggest Prompt */}
            <Card>
              <CardHeader>
                <CardTitle>Suggest New Prompt</CardTitle>
                <CardDescription>
                  Generate a fresh prompt based on existing ones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  disabled={loadingSuggest}
                  onClick={async () => {
                    setLoadingSuggest(true);
                    const { data, error } = await supabase.functions.invoke(
                      "suggest-prompt"
                    );
                    setLoadingSuggest(false);
                    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                    else {
                      toast({ title: "Success", description: "Prompt generated!" });
                      console.log(data);
                    }
                  }}
                >
                  {loadingSuggest ? "Running…" : <><Zap className="mr-2 w-4 h-4" />Run</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
