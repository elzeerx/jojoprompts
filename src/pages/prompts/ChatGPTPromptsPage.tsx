import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ModernPromptCard } from "@/components/ui/modern-prompt-card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type PromptRow } from "@/types/prompts";
import { Container } from "@/components/ui/container";
import { getSubscriptionTier, hasFeatureInPlan } from "@/utils/subscription";
import { PromptService } from "@/services/PromptService";
import { createLogger } from '@/utils/logging';

const logger = createLogger('CHATGPT_PROMPTS');

export default function ChatGPTPromptsPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userTier, setUserTier] = useState<string>('none');
  
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate("/pricing");
        return;
      }
      
      try {
        // Admins have full access
        if (isAdmin) {
          setHasAccess(true);
          setUserTier('ultimate');
        } else {
          const { data: subscriptions, error } = await supabase
            .from("user_subscriptions")
            .select("plan_id, subscription_plans:plan_id(name, features, is_lifetime)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1);
          
          if (error && error.code !== "PGRST116") {
            logger.error('Error checking subscription', { error: error.message });
          }
          
          let tier = 'none';
          let access = false;
          
          if (subscriptions && subscriptions.length > 0) {
            const subscription = subscriptions[0];
            const planName = subscription.subscription_plans?.name;
            const planFeatures = subscription.subscription_plans?.features;
            const isLifetime = subscription.subscription_plans?.is_lifetime ?? false;
            tier = getSubscriptionTier(planName);
            
            // Lifetime plans have access to EVERYTHING
            if (isLifetime) {
              access = true;
            } else {
              access = hasFeatureInPlan(planFeatures, 'ChatGPT prompts');
            }
          }
          
          setUserTier(tier);
          setHasAccess(access);
        }
        
        // Fetch ChatGPT prompts using unified service
        const result = await PromptService.getPublicPrompts(100, 0, 'text');
        
        if (result.success && result.data) {
          setPrompts(result.data);
        } else {
          logger.error('Error fetching prompts', { error: result.error });
        }
      } catch (err: any) {
        logger.error('Error checking access', { error: err.message || err });
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, [user, navigate, isAdmin]);
  
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
            <ModernPromptCard 
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
