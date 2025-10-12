import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Invalid domain patterns to block
const BLOCKED_DOMAINS = [
  '.local',
  '.test',
  '.invalid',
  '.localhost',
  '.example',
  '.test.com',
];

// Disposable email domains to block
const DISPOSABLE_DOMAINS = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  'yopmail.com',
  'maildrop.cc',
];

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'system',
  'superadmin',
  'support',
  'help',
  'info',
  'contact',
  'jojo',
  'jojoprompts',
  'moderator',
  'mod',
];

interface SignupValidationRequest {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  ipAddress?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Validate email domain
function validateEmailDomain(email: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    errors.push('Invalid email format');
    return { valid: false, errors };
  }
  
  // Check blocked domains
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain.endsWith(blocked) || domain === blocked.substring(1)) {
      errors.push('This email domain is not allowed for registration');
      return { valid: false, errors };
    }
  }
  
  // Check disposable domains
  for (const disposable of DISPOSABLE_DOMAINS) {
    if (domain === disposable || domain.endsWith(`.${disposable}`)) {
      errors.push('Temporary or disposable email addresses are not allowed');
      return { valid: false, errors };
    }
  }
  
  // Basic domain format check
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    errors.push('Invalid email domain format');
    return { valid: false, errors };
  }
  
  return { valid: true, errors, warnings };
}

// Validate username
function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];
  
  // Check length
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }
  if (username.length > 20) {
    errors.push('Username must be less than 20 characters');
  }
  
  // Check for @ prefix
  if (username.startsWith('@')) {
    errors.push('Username cannot start with @');
  }
  
  // Check format (alphanumeric + underscore/dash only)
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and dashes');
  }
  
  // Check reserved usernames
  const lowerUsername = username.toLowerCase();
  if (RESERVED_USERNAMES.includes(lowerUsername)) {
    errors.push('This username is reserved and cannot be used');
  }
  
  // Check if starts with common prefixes that might be confusing
  if (lowerUsername.startsWith('admin') || 
      lowerUsername.startsWith('mod_') || 
      lowerUsername.startsWith('system')) {
    errors.push('Username cannot start with reserved prefixes');
  }
  
  return { valid: errors.length === 0, errors };
}

// Check rate limiting for signups
async function checkSignupRateLimit(
  supabase: any,
  ipAddress: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowMinutes = 60;
  const maxSignups = 3;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  
  // Count recent signup attempts from this IP
  const { data: recentSignups, error } = await supabase
    .from('signup_audit_log')
    .select('id')
    .eq('ip_address', ipAddress)
    .gte('created_at', windowStart);
  
  if (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true }; // Fail open to not block legitimate signups
  }
  
  const signupCount = recentSignups?.length || 0;
  
  if (signupCount >= maxSignups) {
    const retryAfterSeconds = windowMinutes * 60;
    return { allowed: false, retryAfter: retryAfterSeconds };
  }
  
  return { allowed: true };
}

// Log signup attempt for audit
async function logSignupAttempt(
  supabase: any,
  request: SignupValidationRequest,
  success: boolean,
  errors: string[]
) {
  try {
    await supabase
      .from('signup_audit_log')
      .insert({
        email: request.email,
        username: request.username,
        ip_address: request.ipAddress || 'unknown',
        success,
        error_messages: errors.length > 0 ? errors : null,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn('Failed to log signup attempt:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody: SignupValidationRequest = await req.json();
    const { email, username, firstName, lastName, ipAddress } = requestBody;
    
    console.log(`[SignupValidation] Validating signup for ${email}, username: ${username}`);
    
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    
    // Validate email domain
    const emailValidation = validateEmailDomain(email);
    if (!emailValidation.valid) {
      allErrors.push(...emailValidation.errors);
    }
    if (emailValidation.warnings) {
      allWarnings.push(...emailValidation.warnings);
    }
    
    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      allErrors.push(...usernameValidation.errors);
    }
    
    // Check rate limiting if IP provided
    if (ipAddress) {
      const rateLimitCheck = await checkSignupRateLimit(supabase, ipAddress);
      if (!rateLimitCheck.allowed) {
        allErrors.push(`Too many signup attempts. Please try again in ${Math.ceil((rateLimitCheck.retryAfter || 3600) / 60)} minutes.`);
      }
    }
    
    // Check if email already exists
    const { data: existingUsers } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .limit(1);
    
    if (existingUsers && existingUsers.length > 0) {
      allErrors.push('An account with this email already exists');
    }
    
    // Check if username already exists
    const { data: existingUsernames } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .limit(1);
    
    if (existingUsernames && existingUsernames.length > 0) {
      allErrors.push('This username is already taken');
    }
    
    const isValid = allErrors.length === 0;
    
    // Log the attempt
    await logSignupAttempt(supabase, requestBody, isValid, allErrors);
    
    // If validation failed, return errors
    if (!isValid) {
      console.log(`[SignupValidation] Validation failed for ${email}:`, allErrors);
      return new Response(
        JSON.stringify({
          valid: false,
          errors: allErrors,
          warnings: allWarnings
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`[SignupValidation] Validation passed for ${email}`);
    
    return new Response(
      JSON.stringify({
        valid: true,
        errors: [],
        warnings: allWarnings
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[SignupValidation] Error:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        errors: ['An unexpected error occurred during validation']
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
