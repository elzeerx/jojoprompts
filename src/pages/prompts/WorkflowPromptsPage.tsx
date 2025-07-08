
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PromptCard } from "@/components/ui/prompt-card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Prompt } from "@/types";
import { Container } from "@/components/ui/container";
import { getSubscriptionTier, isCategoryLocked } from "@/utils/subscription";

export default function WorkflowPromptsPage() {
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
          // Check user's subscription
          const { data: subscriptions, error } = await supabase
            .from("user_subscriptions")
            .select("plan_id, subscription_plans:plan_id(name, features)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();
          
          if (error && error.code !== "PGRST116") {
            console.error("Error checking subscription:", error);
          }
          
          let tier = 'none';
          if (subscriptions?.subscription_plans) {
            const planName = subscriptions.subscription_plans.name;
            tier = getSubscriptionTier(planName);
          }
          
          setUserTier(tier);
          
          // Check if user has access to workflow prompts (premium plan requirement)
          const hasAccess = !isCategoryLocked('premium', tier, isUserAdmin);
          setHasAccess(hasAccess);
        }
        
        // Fetch workflow prompts regardless of access
        const { data, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
          .eq("prompt_type", "workflow")
          .order("created_at", { ascending: false });
        
        if (promptsError) {
          console.error("Error fetching prompts:", promptsError);
        } else if (data) {
          // Transform data to ensure it matches the Prompt type
          const transformedData: Prompt[] = data.map(item => ({
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
