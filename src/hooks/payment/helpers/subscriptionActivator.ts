
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if an active subscription exists for the user-plan pair,
 * or creates one if the payment is verified.
 */
export async function activateSubscription({ planId, userId, paymentMethod, paymentId, paymentDetails, accessToken }: {
  planId: string,
  userId: string,
  paymentMethod: string,
  paymentId: string,
  paymentDetails: any,
  accessToken?: string
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  // Try to create a subscription via edge function
  const { data, error } = await supabase.functions.invoke("create-subscription", {
    headers,
    body: {
      planId,
      userId,
      paymentData: {
        paymentMethod,
        paymentId,
        details: paymentDetails
      }
    }
  });
  return { data, error };
}
