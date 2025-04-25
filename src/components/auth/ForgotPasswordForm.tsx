
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [resetEmail, setResetEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const { toast } = useToast();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const origin = window.location.origin;
      const resetUrl = `${origin}/login?tab=reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: resetUrl,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        setResetRequested(true);
        toast({
          title: "Password Reset Email Sent",
          description: "Check your inbox for the password reset link.",
        });
      }
    } catch (error) {
      console.error("Password reset request error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleResetRequest}>
      <div className="space-y-4 pt-4">
        {resetRequested ? (
          <div className="text-center py-4">
            <p className="mb-4">Password reset email sent!</p>
            <p className="text-sm text-muted-foreground">
              Check your inbox for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="resetEmail">Email</Label>
            <Input
              id="resetEmail"
              type="email"
              placeholder="name@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </div>
        )}
      </div>
      <div className="flex flex-col space-y-4 pt-6">
        {!resetRequested ? (
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        ) : (
          <Button 
            type="button" 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setResetRequested(false);
              setResetEmail("");
            }}
          >
            Try Again
          </Button>
        )}
      </div>
    </form>
  );
}
