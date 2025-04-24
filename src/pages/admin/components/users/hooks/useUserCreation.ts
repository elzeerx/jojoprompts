
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateUserData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export function useUserCreation() {
  const [isCreating, setIsCreating] = useState(false);

  const createUser = async (userData: CreateUserData) => {
    try {
      setIsCreating(true);
      
      // Use edge function to create user with service role
      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: { 
            action: "create",
            userData: {
              email: userData.email,
              password: userData.password,
              first_name: userData.first_name,
              last_name: userData.last_name
            }
          }
        }
      );
      
      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error.message || "Failed to create user");
      }
      
      if (!data?.user?.id) {
        throw new Error("No user ID returned");
      }
      
      // If role is specified and different from default 'user'
      if (userData.role && userData.role !== 'user') {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: userData.role })
          .eq('id', data.user.id);
          
        if (roleError) {
          console.error("Error setting user role:", roleError);
          // Don't throw, as user is already created
          toast({
            title: "Warning",
            description: "User created, but role could not be set",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "Success",
        description: `User ${userData.email} created successfully`,
      });
      
      return true;
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    createUser
  };
}
