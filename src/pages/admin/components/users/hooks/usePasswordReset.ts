import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePasswordReset() {
  const handleSendPasswordResetEmail = async (email: string) => {
    try {
      // Use custom password reset edge function (uses Resend)
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email }
      });

      if (error) {
        toast({
          title: "Email not sent",
          description: error.message || "Failed to send password reset email.",
          variant: "destructive"
        });
        return;
      }

      if (data && !data.success) {
        toast({
          title: "Email not sent",
          description: data.error || "Failed to send password reset email.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Password reset email sent! 📧",
        description: "Password reset email has been sent successfully."
      });
    } catch (error: any) {
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
