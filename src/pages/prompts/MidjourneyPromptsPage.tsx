
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PromptCard } from "@/components/ui/prompt-card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Prompt } from "@/types";

export default function MidjourneyPromptsPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
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
        } else {
          // Check if user has access to Midjourney prompts (Standard or Premium plans)
          const { data: subscriptions, error } = await supabase
            .from("user_subscriptions")
            .select("plan_id, subscription_plans:plan_id(name, features)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();
          
          if (error && error.code !== "PGRST116") {
            console.error("Error checking subscription:", error);
          }
          
          let canAccess = false;
          if (subscriptions?.subscription_plans) {
            const planName = subscriptions.subscription_plans.name.toLowerCase();
            setUserPlan(planName);
            
            // Standard and Premium plans have access to Midjourney prompts
            canAccess = ["standard", "premium", "ultimate"].includes(planName);
          }
          
          setHasAccess(canAccess);
        }
        
        // Fetch Midjourney prompts regardless of access
        const { data, error: promptsError } = await supabase
          .from("prompts")
          .select("*")
          .eq("prompt_type", "image")
          .order("created_at", { ascending: false });
        
        if (promptsError) {
          console.error("Error fetching prompts:", promptsError);
        } else {
          setPrompts(data || []);
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
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="bg-muted/20 p-6 rounded-full mb-6">
            <Lock className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Premium Content</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need a Standard or Premium subscription to access Midjourney prompts. 
            {userPlan === "basic" ? " Please upgrade your Basic plan." : " Subscribe now to unlock this content."}
          </p>
          <Button 
            onClick={() => navigate("/pricing")} 
            className="bg-warm-gold hover:bg-warm-gold/90"
            size="lg"
          >
            View Pricing Plans
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Midjourney Prompts</h1>
        <p className="text-muted-foreground">
          Explore our collection of premium Midjourney prompts
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
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}
    </div>
  );
}
