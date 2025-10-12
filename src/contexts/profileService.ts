
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export async function fetchUserProfile(currentUser: any, setUserRole: (role: string) => void) {
  try {
    // Query the user_roles table to get the user's role
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .order('role', { ascending: false }) // Get highest priority role first (admin > jadmin > prompter > user)
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    
    // Set role from user_roles table, default to "user" if no role found
    setUserRole(userRoles?.role || "user");
  } catch (error: any) {
    console.error("[AUTH] Error fetching user role:", error);
    setUserRole("user");
    toast({
      title: "Warning",
      description: "Could not load user role data. Some features may be limited.",
      variant: "destructive"
    });
  }
}
