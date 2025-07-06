import { supabase } from "@/integrations/supabase/client";

/**
 * Utility to call Edge Functions using supabase.functions.invoke()
 * which handles authentication automatically
 */
export async function callEdgeFunction(functionName: string, body: any) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new Error(error.message || `Edge function ${functionName} failed`);
  }

  return data;
}