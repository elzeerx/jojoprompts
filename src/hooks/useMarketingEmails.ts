import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('MARKETING_EMAILS');

/**
 * RETIRED (source-only, 2026-07-28): `send-plan-reminder` and
 * `send-bulk-plan-reminders` are now HTTP 410 stubs. V2 has no
 * subscription/plan concept. This hook's only importer,
 * `MarketingEmailsPanel` -> `MarketingPage`, is NOT referenced by
 * `src/pages/admin/layout/adminSectionElements.tsx` — the marketing
 * surface is not wired into Admin V2. The hook is preserved as a
 * neutralized shim.
 */
export function useMarketingEmails() {
  const [sending, setSending] = useState(false);

  const sendReminderEmail = async (
    userEmail: string,
    _firstName: string,
    _lastName: string,
    _isIndividual = true
  ) => {
    setSending(true);
    logger.warn('send-plan-reminder is retired', { email: userEmail });
    toast({
      variant: "destructive",
      title: "Feature unavailable",
      description: "Plan reminder emails were removed with the V2 one-time payment migration.",
    });
    setSending(false);
    return {
      success: false as const,
      error: { message: "endpoint_retired: send-plan-reminder" },
    };
  };

  const sendBulkReminderEmails = async (
    users: Array<{ email: string; first_name: string; last_name: string }>
  ) => {
    setSending(true);
    logger.warn('send-bulk-plan-reminders is retired', { userCount: users.length });
    toast({
      variant: "destructive",
      title: "Feature unavailable",
      description: "Bulk plan reminder emails were removed with the V2 one-time payment migration.",
    });
    setSending(false);
    return {
      success: false as const,
      error: { message: "endpoint_retired: send-bulk-plan-reminders" },
    };
  };

  return {
    sendReminderEmail,
    sendBulkReminderEmails,
    sending,
  };
}
