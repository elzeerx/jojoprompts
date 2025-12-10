import { serve, corsHeaders, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";
import { logEmailAttempt } from "../_shared/emailLogger.ts";
import { validatePaymentInput, ResendPaymentEmailSchema } from "../_shared/paymentValidation.ts";

const logger = createEdgeLogger('RESEND_PAYMENT_EMAIL');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await verifyAdmin(req);
    const rawBody = await req.json();

    // Validate input
    const validationResult = validatePaymentInput(ResendPaymentEmailSchema, rawBody);
    if (!validationResult.success) {
      logger.error('Input validation failed', { error: validationResult.error });
      return createErrorResponse(validationResult.error, 400);
    }

    const { transactionId, email } = validationResult.data;

    logger.info('Admin resending payment email', { transactionId, email, adminId: userId });

    // Fetch transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, subscription_plans!transactions_plan_id_fkey(*)')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      logger.error('Transaction not found', { 
        error: txError?.message || txError,
        transactionId 
      });
      return createErrorResponse(
        txError?.message || 'Transaction not found', 
        404
      );
    }

    // Validate subscription_plans relationship
    if (!transaction.subscription_plans) {
      logger.error('Transaction has no associated plan', { transactionId });
      return createErrorResponse('Transaction has no associated subscription plan', 400);
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', transaction.user_id)
      .single();

    const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Valued Customer';
    const planName = transaction.subscription_plans?.name || 'Premium Plan';

    // Prepare email payload
    const purchaseDate = new Date(transaction.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const getSiteUrl = () => {
      const rawFrontendUrl = Deno.env.get('FRONTEND_URL');
      let siteUrl = rawFrontendUrl;
      if (!siteUrl) {
        siteUrl = (Deno.env.get('SUPABASE_URL')?.replace('/supabase', '') ?? '');
      }
      return siteUrl.replace(/\/+$/, '');
    };

    const payload = {
      to: email,
      template_slug: 'payment_confirmation',
      email_type: 'payment_confirmation',
      variables: {
        first_name: userName.split(' ')[0] || 'Valued Customer',
        plan_name: planName,
        amount: Number(transaction.amount_usd || 0).toFixed(2),
        transaction_id: transaction.id,
        purchase_date: purchaseDate,
        email: email,
        unsubscribe_link: `${getSiteUrl()}/unsubscribe?email=${encodeURIComponent(email)}&type=payment_confirmation`
      }
    };

    // Send email
    const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-email', {
      body: payload
    });

    const emailSuccess = !emailError && (!emailResponse || !emailResponse.unsubscribed);

    // Log email attempt
    await logEmailAttempt(
      supabase,
      email,
      'payment_confirmation',
      emailSuccess,
      emailError?.message || (emailResponse?.unsubscribed ? 'User unsubscribed' : undefined),
      transaction.user_id
    );

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_user_id: userId,
      action: 'resend_payment_email',
      target_resource: 'transactions',
      metadata: {
        transaction_id: transactionId,
        recipient_email: email,
        email_success: emailSuccess
      }
    });

    if (!emailSuccess) {
      logger.error('Failed to resend email', { error: emailError });
      return createErrorResponse(emailError?.message || 'Failed to send email', 500);
    }

    logger.info('Payment email resent successfully', { transactionId, email });
    return createSuccessResponse({ message: 'Payment email sent successfully' });

  } catch (error: any) {
    logger.error('Error resending payment email', { error: error.message });
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
