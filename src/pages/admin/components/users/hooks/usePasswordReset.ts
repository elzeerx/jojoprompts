
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePasswordReset() {
  const handleSendPasswordResetEmail = async (email: string) => {
    try {
      // Generate reset link using Supabase auth with proper redirect URL
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?type=recovery&tab=reset`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Password reset email sent! 📧",
        description: "Password reset email has been sent successfully."
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      
      toast({
        title: "Email not sent",
        description: error.message || "Failed to send password reset email.",
        variant: "destructive"
      });
    }
  };

  return {
    sendPasswordResetEmail: handleSendPasswordResetEmail
  };
}
