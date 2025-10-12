import { useState, useEffect } from "react";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { PromptWizardDialog } from "@/components/prompts";
import { AdminPromptCard } from "@/pages/admin/components/prompts/AdminPromptCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { type PromptRow } from "@/types";

export default function PromptGeneratorPage() {
  const { user, canManagePrompts, loading } = useAuth();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);

  const fetchRecentPrompts = async () => {
    if (!user) return;
    
    setIsLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .eq("user_id", user.id)
        .returns<PromptRow[]>()
        .order("created_at", { ascending: false })
        .limit(6);
      
      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error("Error fetching recent prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load recent prompts",
        variant: "destructive"
      });
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRecentPrompts();
    }
  }, [user]);

  const handlePromptComplete = async () => {
    toast({
      title: "Success",
      description: "Prompt created successfully",
    });
    await fetchRecentPrompts();
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
      console.error("Error deleting prompt:", error);
      fetchRecentPrompts();
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft-bg/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warm-gold mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canManagePrompts) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-warm-gold" />
            <h1 className="section-title text-xl sm:text-2xl lg:text-3xl text-dark-base">
              Prompt Generator
            </h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm lg:text-base">
            Create AI prompts with our multi-step wizard featuring platform-specific configurations
          </p>
        </div>

        {/* Create Prompt Card */}
        <Card className="mb-6 sm:mb-8 border-warm-gold/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-dark-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-warm-gold" />
              Create New Prompt
            </CardTitle>
            <CardDescription>
              Use the multi-step wizard to create prompts with platform selection, dynamic fields, and validation
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <PromptWizardDialog
              trigger={
                <Button size="lg" className="bg-warm-gold hover:bg-warm-gold/90">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Prompt with Wizard
                </Button>
              }
              mode="create"
              onComplete={handlePromptComplete}
            />
          </CardContent>
        </Card>

        {/* Recent Prompts */}
        <Card className="border-warm-gold/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-dark-base">Recent Prompts</CardTitle>
            <CardDescription>
              Your latest prompts created with the generator
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPrompts ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-warm-gold mx-auto" />
              </div>
            ) : prompts.length === 0 ? (
              <div className="text-center py-8 bg-soft-bg/30 rounded-xl border border-warm-gold/20 p-8">
                <p className="text-muted-foreground mb-4">No prompts created yet</p>
                <PromptWizardDialog
                  trigger={
                    <Button className="bg-warm-gold hover:bg-warm-gold/90">
                      Create Your First Prompt
                    </Button>
                  }
                  mode="create"
                  onComplete={handlePromptComplete}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prompts.map((prompt) => (
                  <AdminPromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onEdit={() => {}}
                    onDelete={handleDeletePrompt}
                    initiallyFavorited={false}
                    onEditSuccess={fetchRecentPrompts}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
