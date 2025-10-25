import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:userCreate');

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
  logger.info('Admin attempting to create new user', { adminId, email: userData.email });
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
      logger.error('Error creating user', { error: createError.message, email: userData.email });
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
        logger.error('Error creating profile for new user', { error: profileError.message, userId: createData.user.id });
      }
    }

    logger.info('Successfully created user', { userId: createData.user.id, email: userData.email });
    return {
      success: true,
      message: 'User created successfully',
      user: createData.user
    };
  } catch (error) {
    logger.error('Error in createUser', { error, email: userData.email });
    throw error;
  }
}
