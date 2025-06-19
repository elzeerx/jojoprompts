
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { emailService } from "@/utils/emailService";

export function usePasswordReset() {
  const handleSendPasswordResetEmail = async (email: string) => {
    try {
      // Generate reset link using Supabase auth
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?tab=reset`,
      });
      
      if (error) throw error;
      
      // Note: Supabase will send its own reset email, but we could also send a custom one
      // For now, we'll use Supabase's built-in email system
      toast({
        title: "Password reset email sent! 📧",
        description: "Password reset email has been sent successfully via Name.com SMTP."
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
