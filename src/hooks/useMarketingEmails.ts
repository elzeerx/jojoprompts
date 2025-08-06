import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useMarketingEmails() {
  const [sending, setSending] = useState(false);

  const sendReminderEmail = async (
    userEmail: string,
    firstName: string,
    lastName: string,
    isIndividual = true
  ) => {
    try {
      setSending(true);

      const { data, error } = await supabase.functions.invoke('send-plan-reminder', {
        body: {
          email: userEmail,
          firstName,
          lastName,
          isIndividual
        }
      });

      if (error) throw error;

      toast({
        title: "Email sent successfully",
        description: `Plan reminder email sent to ${userEmail}`,
      });

      return { success: true, data };
    } catch (error: any) {
      console.error("Error sending reminder email:", error);
      toast({
        variant: "destructive",
        title: "Failed to send email",
        description: error.message || "There was an error sending the reminder email",
      });
      return { success: false, error };
    } finally {
      setSending(false);
    }
  };

  const sendBulkReminderEmails = async (users: Array<{
    email: string;
    first_name: string;
    last_name: string;
  }>) => {
    try {
      setSending(true);

      const { data, error } = await supabase.functions.invoke('send-bulk-plan-reminders', {
        body: {
          users
        }
      });

      if (error) throw error;

      toast({
        title: "Bulk emails sent successfully",
        description: `Plan reminder emails sent to ${users.length} users`,
      });

      return { success: true, data };
    } catch (error: any) {
      console.error("Error sending bulk reminder emails:", error);
      toast({
        variant: "destructive",
        title: "Failed to send bulk emails",
        description: error.message || "There was an error sending the reminder emails",
      });
      return { success: false, error };
    } finally {
      setSending(false);
    }
  };

  return {
    sendReminderEmail,
    sendBulkReminderEmails,
    sending
  };
}