import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Zap } from "lucide-react";
import { PromptCard } from "@/components/ui/prompt-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
interface PromptsPageContentProps {
  prompts: any[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  reloadPrompts: () => void;
}
export function PromptsPageContent({
  prompts,
  categories,
  isLoading,
  error,
  reloadPrompts
}: PromptsPageContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch user subscription and admin status
  useEffect(() => {
    const checkUserSubscriptionAndRole = async () => {
      if (!user) return;
      try {
        // Check if user is admin
        const {
          data: profileData,
          error: profileError
        } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        setIsAdmin(profileData?.role === "admin");

        // Get user's active subscription
        const {
          data: subscription,
          error: subscriptionError
        } = await supabase.from("user_subscriptions").select("*, subscription_plans:plan_id(*)").eq("user_id", user.id).eq("status", "active").maybeSingle();
        if (subscriptionError && subscriptionError.code !== "PGRST116") {
          throw subscriptionError;
        }
        setUserSubscription(subscription);
      } catch (error) {
        console.error("Error fetching user subscription data:", error);
      } finally {
        setLoading(false);
      }
    };
    checkUserSubscriptionAndRole();
  }, [user]);

  // Filter prompts based on search query and category
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = searchQuery === "" || prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) || prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) || prompt.metadata?.tags && prompt.metadata.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || prompt.metadata?.category?.toLowerCase() === selectedCategory.toLowerCase() || selectedCategory === "uncategorized" && !prompt.metadata?.category;
    return matchesSearch && matchesCategory;
  });

  // Check if a prompt is locked based on user subscription
  const isPromptLocked = (promptType: string) => {
    if (isAdmin) return false; // Admins have access to all prompts
    if (!userSubscription) return true; // No subscription means everything is locked

    const planName = userSubscription.subscription_plans?.name.toLowerCase();
    switch (promptType) {
      case "text":
        // ChatGPT prompts - any subscription gives access
        return false;
      case "image":
        // Midjourney prompts - Standard or Premium plans give access
        return !["standard", "premium", "ultimate"].includes(planName);
      case "workflow":
        // n8n workflows - only Premium plans give access
        return !["premium", "ultimate"].includes(planName);
      default:
        return true;
    }
  };
  const handleUpgradeClick = () => {
    navigate("/pricing");
  };
  return <div className="container mx-auto px-4 py-8">
      {/* Search and filter section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="relative w-full md:w-auto md:flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search prompts..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          
          
          
        </div>
      </div>

      {/* Category tabs */}
      <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
        <TabsList className="w-full h-auto flex-wrap justify-start bg-transparent p-0 gap-2">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All
          </TabsTrigger>
          {categories.map(category => <TabsTrigger key={category} value={category.toLowerCase()} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {category}
            </TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* Prompts display */}
      {isLoading || loading ? <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div> : error ? <div className="text-center py-12">
          <p className="text-red-500 mb-4">Error loading prompts: {error}</p>
          <Button onClick={reloadPrompts}>Try Again</Button>
        </div> : filteredPrompts.length === 0 ? <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No prompts found.</p>
        </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} isLocked={isPromptLocked(prompt.prompt_type)} onUpgradeClick={handleUpgradeClick} />)}
        </div>}
    </div>;
}