import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PromptCard } from "@/components/ui/prompt-card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Prompt } from "@/types";
import { Container } from "@/components/ui/container";
import { getSubscriptionTier, hasFeatureInPlan } from "@/utils/subscription";
import { PromptService } from "@/services/PromptService";

export default function ChatGPTPromptsPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userTier, setUserTier] = useState<string>('none');
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate("/pricing");
        return;
      }
      
      try {
        // Check if user is admin
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
          
        if (profileError) throw profileError;
        
        const isUserAdmin = profileData?.role === "admin";
        setIsAdmin(isUserAdmin);
        
        if (isUserAdmin) {
          setHasAccess(true);
          setUserTier('ultimate');
        } else {
          // Get the most recent active subscription - FIXED QUERY
          const { data: subscriptions, error } = await supabase
            .from("user_subscriptions")
            .select("plan_id, subscription_plans:plan_id(name, features)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (error && error.code !== "PGRST116") {
            console.error("Error checking subscription:", error);
          }
          
          let tier = 'none';
          let hasAccess = false;
          
          console.log('Raw subscription data:', subscriptions);
          
          if (subscriptions && subscriptions.length > 0) {
            const subscription = subscriptions[0];
            const planName = subscription.subscription_plans?.name;
            const planFeatures = subscription.subscription_plans?.features;
            tier = getSubscriptionTier(planName);
            
            console.log('ChatGPT access check:', { 
              planName, 
              planFeatures, 
              tier,
              userId: user.id,
              subscriptionCount: subscriptions.length
            });
            
            // Check if user's plan includes ChatGPT prompts feature
            hasAccess = hasFeatureInPlan(planFeatures, 'ChatGPT prompts');
            
            console.log('ChatGPT access result:', { hasAccess, featureCheck: planFeatures });
          } else {
            console.log('No active subscriptions found for user:', user.id);
          }
          
          setUserTier(tier);
          setHasAccess(hasAccess);
        }
        
        // Fetch ChatGPT prompts using unified service
        const result = await PromptService.getPublicPrompts(100, 0, 'text');
        
        if (result.success && result.data) {
          // Transform to match existing Prompt interface
          const transformedData: Prompt[] = result.data.map(item => ({
            id: item.id,
            user_id: item.user_id,
            title: item.title,
            prompt_text: item.prompt_text,
            image_path: item.image_path,
            default_image_path: item.default_image_path || null,
            prompt_type: item.prompt_type as 'text' | 'image' | 'button' | 'image-selection' | 'workflow',
            created_at: item.created_at || "",
            metadata: item.metadata as any || {}
          }));
          
          setPrompts(transformedData);
        } else {
          console.error("Error fetching prompts:", result.error);
        }
      } catch (err) {
        console.error("Error checking access:", err);
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, [user, navigate]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!hasAccess) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="bg-muted/20 p-6 rounded-full mb-6">
            <Lock className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Premium Content</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need a subscription to access ChatGPT prompts. Upgrade now to unlock this content.
          </p>
          <Button 
            onClick={() => navigate("/pricing")} 
            className="bg-warm-gold hover:bg-warm-gold/90"
            size="lg"
          >
            View Pricing Plans
          </Button>
        </div>
      </Container>
    );
  }
  
  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">ChatGPT Prompts</h1>
        <p className="text-muted-foreground">
          Explore our collection of premium ChatGPT prompts
          {isAdmin && " (Admin Access)"}
        </p>
      </div>
      
      {prompts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No prompts available yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map((prompt) => (
            <PromptCard 
              key={prompt.id} 
              prompt={prompt}
              isLocked={false}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
