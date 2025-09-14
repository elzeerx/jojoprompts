
import { corsHeaders } from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";


export async function handleCreateUser(supabase: any, adminId: string, req: Request) {
  try {
    const body = await req.json();
    
    // Validate request parameters for user creation
    const validation = ParameterValidator.validateParameters(body, ParameterValidator.SCHEMAS.USER_CREATE);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters', details: validation.errors }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate unique username
    const generateUsername = async (baseUsername: string): Promise<string> => {
      let username = baseUsername;
      let counter = 0;
      
      while (true) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single();
          
        if (!existingUser) {
          return username;
        }
        
        counter++;
        username = `${baseUsername}${counter}`;
        
        if (counter > 999) {
          throw new Error('Unable to generate unique username');
        }
      }
    };

    // Create base username from available data
    let baseUsername = '';
    if (validation.sanitizedData.firstName || validation.sanitizedData.lastName) {
      baseUsername = `${validation.sanitizedData.firstName || ''}${validation.sanitizedData.lastName || ''}`.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    }
    
    if (!baseUsername) {
      baseUsername = validation.sanitizedData.email.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    }
    
    if (!baseUsername) {
      baseUsername = 'user';
    }

    const uniqueUsername = await generateUsername(baseUsername);

    // Log the user creation attempt
    await logAdminAction(supabase, adminId, 'create_user', 'users', {
      email: validation.sanitizedData.email
    });

    // Create user in auth system
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: validation.sanitizedData.email,
      email_confirm: true,
      user_metadata: {
        first_name: validation.sanitizedData.firstName,
        last_name: validation.sanitizedData.lastName
      },
      app_metadata: {
        role: validation.sanitizedData.role || 'user'
      }
    });

    if (authError) {
      console.error('Error creating user in auth system:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: authError.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if profile already exists (defensive programming)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (existingProfile) {
      console.log(`[createUserHandler] Profile already exists for user ${authData.user.id}, skipping profile creation`);
    } else {
      // Create profile record with username
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: validation.sanitizedData.firstName,
          last_name: validation.sanitizedData.lastName,
          username: uniqueUsername,
          role: validation.sanitizedData.role || 'user'
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        
        // Attempt to clean up auth user if profile creation fails
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          console.error('Failed to clean up auth user after profile creation error:', cleanupError);
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile', details: profileError.message }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Log successful user creation
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_created',
      details: { 
        created_user_id: authData.user.id,
        role: validation.sanitizedData.role || 'user'
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName: validation.sanitizedData.firstName,
          lastName: validation.sanitizedData.lastName,
          username: uniqueUsername,
          role: validation.sanitizedData.role || 'user'
        }
      }), 
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleCreateUser:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create user' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
