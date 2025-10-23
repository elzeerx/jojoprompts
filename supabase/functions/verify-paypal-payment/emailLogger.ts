import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('verify-paypal-payment:email-logger');

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
      logger.error('Failed to log email attempt', { error });
    } else {
      logger.debug('Email attempt logged successfully');
    }
  } catch (error) {
    logger.error('Exception logging email attempt', { error });
  }
}
