
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PasswordResetSecurity } from "@/utils/passwordResetSecurity";

export function usePasswordReset() {
  const handleSendPasswordResetEmail = async (email: string) => {
    const result = await PasswordResetSecurity.initiatePasswordReset(email);
    
    if (result.success) {
      toast({
        title: "Password reset email sent! 📧",
        description: "Password reset email has been sent successfully."
      });
    } else {
      toast({
        title: "Email not sent",
        description: result.error || "Failed to send password reset email.",
        variant: "destructive"
      });
    }
  };

  return {
    sendPasswordResetEmail: handleSendPasswordResetEmail
  };
}
