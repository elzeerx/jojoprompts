
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePasswordReset() {
  const handleSendPasswordResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?tab=reset`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Email sent",
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
