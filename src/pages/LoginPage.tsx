
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { LogIn, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/10 to-muted-teal/20 flex items-center justify-center mobile-container-padding">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-warm-gold/10 p-3">
              <LogIn className="h-8 w-8 text-warm-gold" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-dark-base">Welcome Back</CardTitle>
          <p className="text-muted-foreground">Access your JojoPrompts account</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Ready to access premium AI prompts? Choose a plan to get started or continue with your existing subscription.
            </p>
            <Button asChild className="w-full bg-warm-gold hover:bg-warm-gold/90">
              <Link to="/pricing" className="flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              New to JojoPrompts? Start with our pricing plans to access thousands of premium AI prompts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
