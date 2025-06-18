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

  console.log("PromptsPageContent - Active categories:", activeCategories);
  console.log("PromptsPageContent - Total prompts:", prompts.length);
  console.log("PromptsPageContent - Selected category:", selectedCategory);

  // Fetch user subscription and admin status
  useEffect(() => {
    const checkUserSubscriptionAndRole = async () => {
      if (!user) return;
      try {
        const {
          data: profileData,
          error: profileError
        } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        setIsAdmin(profileData?.role === "admin");

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

  // Helper function to check if a prompt category matches an active category
  const isPromptCategoryActive = (promptCategory: string | undefined) => {
    if (!promptCategory) return false;
    if (activeCategories.length === 0) return true; // If no active categories, show all
    
    // Check if the prompt's category matches any active category
    return activeCategories.some(activeCategory => {
      const normalizedPromptCategory = promptCategory.toLowerCase().trim();
      const normalizedActiveCategory = activeCategory.name.toLowerCase().trim();
      
      // Exact match or partial match
      return normalizedPromptCategory === normalizedActiveCategory ||
             normalizedPromptCategory.includes(normalizedActiveCategory) ||
             normalizedActiveCategory.includes(normalizedPromptCategory) ||
             normalizedPromptCategory.replace(/\s+prompts?$/i, '') === normalizedActiveCategory.replace(/\s+prompts?$/i, '');
    });
  };

  // Helper function to check if a prompt matches the selected category
  const doesPromptMatchSelectedCategory = (promptCategory: string | undefined, selectedCat: string) => {
    if (selectedCat === "all") return true;
    if (!promptCategory) return false;
    
    const normalizedPromptCategory = promptCategory.toLowerCase().trim();
    const normalizedSelectedCategory = selectedCat.toLowerCase().trim();
    
    // Direct comparison with the selected category
    return normalizedPromptCategory === normalizedSelectedCategory ||
           normalizedPromptCategory.includes(normalizedSelectedCategory) ||
           normalizedSelectedCategory.includes(normalizedPromptCategory) ||
           normalizedPromptCategory.replace(/\s+prompts?$/i, '') === normalizedSelectedCategory.replace(/\s+prompts?$/i, '');
  };

  // Filter prompts based on search query and category
  const filteredPrompts = prompts.filter(prompt => {
    const promptCategory = prompt.metadata?.category;
    
    console.log(`Checking prompt "${prompt.title}" with category:`, promptCategory);
    
    // Category filtering - only show prompts with active categories
    const isCategoryActive = isPromptCategoryActive(promptCategory);
    console.log(`Category "${promptCategory}" is active:`, isCategoryActive);
    
    if (!isCategoryActive) {
      console.log(`Filtering out prompt "${prompt.title}" due to inactive category`);
      return false;
    }

    // Search filtering
    const matchesSearch = searchQuery === "" || 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (prompt.metadata?.tags && prompt.metadata.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    // Selected category filtering - compare directly with selected category
    const matchesCategory = doesPromptMatchSelectedCategory(promptCategory, selectedCategory);
    
    const result = matchesSearch && matchesCategory;
    console.log(`Prompt "${prompt.title}" - Search: ${matchesSearch}, Category: ${matchesCategory}, Final: ${result}`);
    
    return result;
  });

  console.log("PromptsPageContent - Filtered prompts count:", filteredPrompts.length);

  // Check if a prompt is locked based on user subscription and category
  const isPromptLockedByCategory = (prompt: any) => {
    if (isAdmin) return false;
    
    const planName = userSubscription?.subscription_plans?.name;
    const userTier = getSubscriptionTier(planName);
    
    // Find the matching active category for this prompt
    const promptCategory = prompt.metadata?.category;
    const matchingCategory = activeCategories.find(cat => {
      const normalizedPromptCategory = promptCategory?.toLowerCase().trim() || '';
      const normalizedCategoryName = cat.name.toLowerCase().trim();
      
      return normalizedPromptCategory === normalizedCategoryName ||
             normalizedPromptCategory.includes(normalizedCategoryName) ||
             normalizedCategoryName.includes(normalizedPromptCategory) ||
             normalizedPromptCategory.replace(/\s+prompts?$/i, '') === normalizedCategoryName.replace(/\s+prompts?$/i, '');
    });
    
    // Use the database category's required_plan field
    const requiredPlan = matchingCategory?.required_plan;
    return isCategoryLocked(requiredPlan, userTier, isAdmin);
  };

  const handleUpgradeClick = () => {
    navigate("/pricing");
  };

  return (
    <div className="mobile-container-padding">
      <div className="container mx-auto">
        {/* Mobile-optimized search and filter section */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          {/* Mobile-first search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input 
              placeholder="Search prompts..." 
              className="mobile-input pl-10 border-warm-gold/20 rounded-lg w-full text-base" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              // Mobile keyboard optimization
              inputMode="search"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Mobile-optimized category tabs */}
        <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6 sm:mb-8">
          <div className="overflow-x-auto pb-3 mb-4 border-b border-warm-gold/10 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="mobile-tabs bg-transparent h-auto p-0 flex w-max min-w-full sm:min-w-0 justify-start space-x-2 sm:space-x-4">
              <TabsTrigger 
                value="all" 
                className="mobile-tab data-[state=active]:bg-warm-gold/10 data-[state=active]:text-warm-gold px-3 py-2 text-dark-base rounded-lg border-b-2 border-transparent data-[state=active]:border-warm-gold whitespace-nowrap text-sm sm:text-base"
              >
                All Categories
              </TabsTrigger>
              {activeCategories.map(category => (
                <TabsTrigger 
                  key={category.id} 
                  value={category.name.toLowerCase()} 
                  className="mobile-tab data-[state=active]:bg-warm-gold/10 data-[state=active]:text-warm-gold px-3 py-2 text-dark-base rounded-lg border-b-2 border-transparent data-[state=active]:border-warm-gold whitespace-nowrap text-sm sm:text-base"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Debug information */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 bg-gray-100 rounded text-sm">
            <div>Total prompts: {prompts.length}</div>
            <div>Filtered prompts: {filteredPrompts.length}</div>
            <div>Active categories: {activeCategories.map(cat => cat.name).join(', ')}</div>
            <div>Selected category: {selectedCategory}</div>
            <div>User tier: {getSubscriptionTier(userSubscription?.subscription_plans?.name)}</div>
          </div>
        )}

        {/* Mobile-optimized prompts display */}
        {isLoading || loading || categoriesLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm sm:text-base">Loading prompts...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16 px-4">
            <p className="text-red-500 mb-6 text-base sm:text-lg">Error loading prompts: {error}</p>
            <Button onClick={reloadPrompts} className="mobile-button-primary">
              Try Again
            </Button>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-muted-foreground mb-6 text-base sm:text-lg">
              {activeCategories.length === 0 
                ? "No active categories found. Please contact an administrator."
                : prompts.length === 0
                ? "No prompts found in the database."
                : `No prompts found matching your criteria. Found ${prompts.length} total prompts, but none match the active categories: ${activeCategories.map(cat => cat.name).join(', ')}`
              }
            </p>
            {prompts.length > 0 && (
              <Button onClick={() => setSelectedCategory("all")} variant="outline" className="mobile-button-secondary">
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          /* Mobile-first responsive grid */
          <div className="mobile-grid">
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
    </div>
  );
}
