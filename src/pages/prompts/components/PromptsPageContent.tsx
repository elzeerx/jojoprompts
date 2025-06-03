
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Zap } from "lucide-react";
import { PromptCard } from "@/components/ui/prompt-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isCategoryLocked, getSubscriptionTier } from "@/utils/subscription";
import { useCategories } from "@/hooks/useCategories";

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
  const { user } = useAuth();
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get active categories from database
  const { categories: dbCategories, loading: categoriesLoading } = useCategories();
  const activeCategories = dbCategories.filter(cat => cat.is_active);
  const activeCategoryNames = activeCategories.map(cat => cat.name);

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

  // Filter prompts based on search query, category, and active categories
  const filteredPrompts = prompts.filter(prompt => {
    // First check if the prompt's category is active (or if no categories are set up yet)
    const promptCategory = prompt.metadata?.category;
    
    // If we have active categories set up, only show prompts with active categories
    if (activeCategoryNames.length > 0 && promptCategory) {
      const isCategoryActive = activeCategoryNames.includes(promptCategory);
      if (!isCategoryActive) {
        return false;
      }
    }

    const matchesSearch = searchQuery === "" || 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (prompt.metadata?.tags && prompt.metadata.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesCategory = selectedCategory === "all" || 
      prompt.metadata?.category?.toLowerCase() === selectedCategory.toLowerCase() || 
      (selectedCategory === "uncategorized" && !prompt.metadata?.category);
    
    return matchesSearch && matchesCategory;
  });

  // Check if a prompt is locked based on user subscription and category
  const isPromptLockedByCategory = (prompt: any) => {
    if (isAdmin) return false; // Admins have access to all prompts
    
    // Get the user's subscription tier
    const planName = userSubscription?.subscription_plans?.name;
    const userTier = getSubscriptionTier(planName);
    
    // Use category-based locking
    const category = prompt.metadata?.category;
    
    console.log(`Checking access for prompt "${prompt.title}":`, {
      category,
      userTier,
      planName,
      hasSubscription: !!userSubscription
    });
    
    return isCategoryLocked(category, userTier, isAdmin);
  };

  const handleUpgradeClick = () => {
    navigate("/pricing");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search and filter section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="relative w-full md:w-auto md:flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search prompts..." 
            className="pl-10 border-warm-gold/20 rounded-lg" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      {/* Category tabs - only show active categories */}
      <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
        <div className="overflow-x-auto pb-3 mb-4 border-b border-warm-gold/10">
          <TabsList className="bg-transparent h-auto p-0 flex w-full justify-start space-x-4">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-warm-gold/10 data-[state=active]:text-warm-gold px-4 py-2 text-dark-base rounded-lg border-b-2 border-transparent data-[state=active]:border-warm-gold"
            >
              All Categories
            </TabsTrigger>
            {categories.filter(category => category !== "all").map(category => (
              <TabsTrigger 
                key={category} 
                value={category.toLowerCase()} 
                className="data-[state=active]:bg-warm-gold/10 data-[state=active]:text-warm-gold px-4 py-2 text-dark-base rounded-lg border-b-2 border-transparent data-[state=active]:border-warm-gold"
              >
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Prompts display */}
      {isLoading || loading || categoriesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Error loading prompts: {error}</p>
          <Button onClick={reloadPrompts}>Try Again</Button>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {activeCategoryNames.length === 0 
              ? "No active categories found. Please contact an administrator."
              : "No prompts found for the selected criteria."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map(prompt => (
            <PromptCard 
              key={prompt.id} 
              prompt={prompt} 
              isLocked={isPromptLockedByCategory(prompt)} 
              onUpgradeClick={handleUpgradeClick} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
