import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ModernPromptCard } from "@/components/ui/modern-prompt-card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type PromptRow } from "@/types/prompts";
import { Container } from "@/components/ui/container";
import { getSubscriptionTier, isCategoryLocked } from "@/utils/subscription";
import { createLogger } from '@/utils/logging';

const logger = createLogger('WORKFLOW_PROMPTS');

export default function WorkflowPromptsPage() {
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
            .select("plan_id, subscription_plans:plan_id(name, features)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();
          
          if (error && error.code !== "PGRST116") {
            logger.error('Error checking subscription', { error: error.message });
          }
          
          let tier = 'none';
          if (subscriptions?.subscription_plans) {
            const planName = subscriptions.subscription_plans.name;
            tier = getSubscriptionTier(planName);
          }
          
          setUserTier(tier);
          
          // Check if user has access to workflow prompts (premium plan requirement)
          const access = !isCategoryLocked('premium', tier, isAdmin);
          setHasAccess(access);
        }
        
        // Fetch workflow prompts with uploader info
        const { data, error: promptsError } = await supabase
          .from("prompts")
          .select(`
            *,
            profiles:user_id(
              first_name,
              last_name,
              username,
              avatar_url
            )
          `)
          .eq("prompt_type", "workflow")
          .order("created_at", { ascending: false });
        
        if (promptsError) {
          logger.error('Error fetching prompts', { error: promptsError.message });
        } else if (data) {
          const transformedData: PromptRow[] = data.map(item => {
            const profile = item.profiles as any;
            return {
              id: item.id,
              user_id: item.user_id,
              title: item.title,
              prompt_text: item.prompt_text,
              image_path: item.image_path,
              default_image_path: item.default_image_path || null,
              prompt_type: item.prompt_type as any,
              created_at: item.created_at || "",
              metadata: item.metadata as any || {},
              uploader_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
              uploader_username: profile?.username,
              uploader_avatar_url: profile?.avatar_url
            };
          });
          
          setPrompts(transformedData);
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
            You need a Premium subscription to access n8n workflow prompts. 
            {userTier === "basic" ? " Please upgrade your Basic plan." : 
             userTier === "standard" ? " Please upgrade your Standard plan." : 
             " Subscribe now to unlock this content."}
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
        <h1 className="text-3xl font-bold">n8n Workflow Prompts</h1>
        <p className="text-muted-foreground">
          Explore our collection of premium n8n workflow templates
          {isAdmin && " (Admin Access)"}
        </p>
      </div>
      
      {prompts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No workflows available yet. Check back soon!</p>
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
