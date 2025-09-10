
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export async function fetchUserProfile(currentUser: any, setUserRole: (role: string) => void) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    setUserRole(profile?.role || "user");
  } catch (error: any) {
    setUserRole("user");
    toast({
      title: "Warning",
      description: "Could not load user profile data. Some features may be limited.",
      variant: "destructive"
    });
  }
}
