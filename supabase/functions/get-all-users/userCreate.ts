
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface UserData {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export async function createUser(
  supabase: ReturnType<typeof createClient>,
  userData: UserData,
  adminId: string
) {
  console.log(`[userCreate] Admin ${adminId} is attempting to create a new user`, userData);
  try {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        first_name: userData.first_name,
        last_name: userData.last_name
      }
    });

    if (createError) {
      console.error(`[userCreate] Error creating user:`, createError);
      throw new Error(`Error creating user: ${createError.message}`);
    }

    if (createData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: createData.user.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role || 'user'
        });

      if (profileError) {
        console.error(`[userCreate] Error creating profile for new user:`, profileError);
      }
    }

    console.log(`[userCreate] Successfully created user ${createData.user.id}`);
    return {
      success: true,
      message: 'User created successfully',
      user: createData.user
    };
  } catch (error) {
    console.error(`[userCreate] Error in createUser:`, error);
    throw error;
  }
}
