
export interface EnvironmentConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  isValid: boolean;
  error?: string;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): EnvironmentConfig {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('Missing required environment variables');
    return {
      supabaseUrl: '',
      serviceRoleKey: '',
      anonKey: '',
      isValid: false,
      error: 'Server configuration error'
    };
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    anonKey,
    isValid: true
  };
}
