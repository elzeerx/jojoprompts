
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, BarChart } from "lucide-react";
import { AdminPromptCard } from "../admin/components/prompts/AdminPromptCard";
import { PromptDialog } from "../admin/components/prompts/PromptDialog";
import { type PromptRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptStatistics } from "@/components/statistics/PromptStatistics";

export default function PrompterDashboard() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromptRow | null>(null);
  
  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'prompter')) {
      navigate('/');
    }
  }, [user, userRole, authLoading, navigate]);

  const fetchMyPrompts = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      console.log("PrompterDashboard - Fetching user's prompts...");
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .eq("user_id", user.id)
        .returns<PromptRow[]>()
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      console.log("PrompterDashboard - Fetched prompts:", data);
      setPrompts(data || []);
    } catch (error) {
      console.error("PrompterDashboard - Error fetching prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load your prompts",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (user && userRole === 'prompter') {
      fetchMyPrompts();
    }
  }, [user, userRole]);
  
  const handleAddPrompt = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  
  const handleEditPrompt = (promptId: string) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      console.log("PrompterDashboard - Editing prompt with metadata:", prompt.metadata);
      setEditing(prompt);
      setDialogOpen(true);
    }
  };
  
  const handleDeletePrompt = async (promptId: string) => {
    try {
      setPrompts((prev) => prev.filter(p => p.id !== promptId));
      
      const { error } = await supabase
        .from("prompts")
        .delete()
        .eq("id", promptId);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    } catch (error) {
      console.error("PrompterDashboard - Error deleting prompt:", error);
      
      // Reload the prompts to restore the state
      fetchMyPrompts();
      
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };
  
  const handleSuccess = async () => {
    console.log("PrompterDashboard - Prompt saved successfully, refreshing prompts...");
    await fetchMyPrompts();
    setDialogOpen(false);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
      </div>
    );
  }

  if (!user || userRole !== 'prompter') {
    return null;
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-dark-base">Prompter Dashboard</h1>
          <p className="text-muted-foreground">Create, manage, and track your prompts</p>
        </div>
        <Button onClick={handleAddPrompt} className="bg-warm-gold hover:bg-warm-gold/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Prompt
        </Button>
      </div>
      
      <Tabs defaultValue="prompts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="prompts">My Prompts</TabsTrigger>
          <TabsTrigger value="statistics">
            <BarChart className="mr-2 h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="prompts" className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block">
                <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
              </div>
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 bg-soft-bg/30 rounded-xl border border-warm-gold/20 p-8">
              <p className="text-muted-foreground mb-4">You haven't created any prompts yet</p>
              <Button onClick={handleAddPrompt} className="bg-warm-gold hover:bg-warm-gold/90">Create Your First Prompt</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prompts.map((prompt) => (
                <AdminPromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onEdit={handleEditPrompt}
                  onDelete={handleDeletePrompt}
                  initiallyFavorited={false}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="statistics" className="space-y-6">
          <PromptStatistics userId={user?.id} isAdminView={false} />
        </TabsContent>
      </Tabs>
      
      <PromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editingPrompt={editing}
        promptType={editing?.prompt_type === 'button' || editing?.prompt_type === 'image-selection' ? 'text' : editing?.prompt_type as 'text' | 'image' | 'workflow' | 'video' | 'sound'}
      />
    </div>
  );
}
