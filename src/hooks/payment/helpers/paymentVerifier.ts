
import { supabase } from "@/integrations/supabase/client";

export async function verifyPayPalPayment(token: string, payerId: string, accessToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const { data, error } = await supabase.functions.invoke("verify-paypal-payment", {
    headers,
    body: {
      order_id: token,
      payer_id: payerId,
    }
  });
  return { data, error };
}
