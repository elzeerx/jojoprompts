
import { supabase } from "@/integrations/supabase/client";

export async function runOrphanedPaymentRecovery(currentUser: any, recoveredOrphaned: boolean, setRecoveredOrphaned: (val: boolean) => void) {
  if (!recoveredOrphaned) {
    try {
      const res = await supabase.functions.invoke("recover-orphaned-payments", {
        body: { userId: currentUser.id }
      });
      if (res.data?.success) {
        setRecoveredOrphaned(true);
      }
    } catch {}
  }
}
