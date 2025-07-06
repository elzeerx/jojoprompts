import { supabase } from "@/integrations/supabase/client";

// Custom domain for Edge Functions only
const EDGE_FUNCTION_URL = "https://api.jojoprompts.com";

/**
 * Utility to call Edge Functions using the custom domain
 * while keeping other Supabase services on the default domain
 */
export async function callEdgeFunction(functionName: string, body: any) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    throw new Error(`Session error: ${sessionError.message}`);
  }
  
  if (!session) {
    throw new Error("No active session found. Please log in again.");
  }

  const response = await fetch(`${EDGE_FUNCTION_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Edge function ${functionName} failed`);
  }

  return response.json();
}