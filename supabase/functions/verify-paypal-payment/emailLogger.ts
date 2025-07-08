
// Email logging utility for tracking email attempts
export async function logEmailAttempt(
  supabaseClient: any, 
  email: string, 
  emailType: string, 
  success: boolean, 
  errorMessage?: string, 
  userId?: string
) {
  try {
    const logData = {
      email_address: email,
      email_type: emailType,
      success: success,
      error_message: errorMessage || null,
      user_id: userId || null,
      attempted_at: new Date().toISOString()
    };

    // Try to insert the log record
    const { error } = await supabaseClient
      .from('email_logs')
      .insert(logData);

    if (error) {
      console.error('[EMAIL LOG] Failed to log email attempt:', error);
    } else {
      console.log('[EMAIL LOG] Email attempt logged successfully');
    }
  } catch (error) {
    console.error('[EMAIL LOG] Exception logging email attempt:', error);
  }
}
