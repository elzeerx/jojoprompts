import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wand2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function PromptGeneratorNavCard() {
  const { canManagePrompts } = useAuth();

  if (!canManagePrompts) {
    return null;
  }

  return (
    <Card className="mobile-card border-warm-gold/20 bg-gradient-to-br from-warm-gold/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-warm-gold/10">
            <Wand2 className="h-5 w-5 text-warm-gold" />
          </div>
          <div>
            <CardTitle className="text-lg text-dark-base">Prompt Generator</CardTitle>
            <CardDescription className="text-xs">Create AI prompts with dynamic fields</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Sparkles className="h-3 w-3" />
          <span>Manage models, fields & templates</span>
        </div>
        <Button asChild size="sm" className="w-full mobile-button-primary">
          <Link to="/prompt-generator">
            Open Generator
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}