
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from './paypalConfig.ts';
import { fetchPayPalAccessToken } from './paypalToken.ts';
import { getSiteUrl } from './siteUrl.ts';
import { makeSupabaseClient, insertTransaction, updateTransactionOnCapture, createUserSubscription } from './dbOperations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to send subscription activation email
async function sendSubscriptionActivationEmail(supabaseClient: any, userId: string, planId: string, paymentAmount: number, paymentMethod: string) {
  try {
    // Get user details
    const { data: user, error: userError } = await supabaseClient.auth.admin.getUserById(userId);
    if (userError || !user) {
      console.error('Failed to get user for email:', userError);
      return;
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('name, duration_days, is_lifetime')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('Failed to get plan for email:', planError);
      return;
    }

    // Calculate subscription end date
    const endDate = plan.is_lifetime 
      ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 years for lifetime
      : new Date(Date.now() + (plan.duration_days || 365) * 24 * 60 * 60 * 1000);

    // Get user name
    const userName = user.user_metadata?.first_name 
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
      : user.email?.split('@')[0] || 'User';

    // Send subscription activation email
    const emailData = {
      to: user.email,
      subject: `Your ${plan.name} Subscription is Now Active! 🚀`,
      html: generateSubscriptionActivationEmail({
        name: userName,
        email: user.email,
        planName: plan.name,
        subscriptionEndDate: endDate.toISOString(),
        amount: paymentAmount,
        paymentMethod: paymentMethod
      })
    };

    const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: emailData
    });

    if (emailError) {
      console.error('Failed to send subscription activation email:', emailError);
    } else {
      console.log('Subscription activation email sent successfully to:', user.email);
    }
  } catch (error) {
    console.error('Error sending subscription activation email:', error);
  }
}

// Helper function to generate subscription activation email HTML
function generateSubscriptionActivationEmail(data: {
  name: string;
  email: string;
  planName: string;
  subscriptionEndDate: string;
  amount: number;
  paymentMethod: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 32px;">Subscription Activated! 🚀</h1>
        <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your ${data.planName} is ready to use</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name}! 🎉</h2>
        
        <p style="color: #666; line-height: 1.6; margin: 20px 0;">
          Great news! Your ${data.planName} subscription has been successfully activated and is now ready to use.
        </p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #dee2e6;">
          <h3 style="color: #333; margin: 0 0 15px 0;">📋 Subscription Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Plan:</td>
              <td style="padding: 10px 0; text-align: right; color: #333;">${data.planName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Amount Paid:</td>
              <td style="padding: 10px 0; text-align: right; color: #333;">$${data.amount.toFixed(2)} USD</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Payment Method:</td>
              <td style="padding: 10px 0; text-align: right; color: #333;">${data.paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Valid Until:</td>
              <td style="padding: 10px 0; text-align: right; color: #333;">${new Date(data.subscriptionEndDate).toLocaleDateString()}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://jojoprompts.com/prompts" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; margin-right: 10px;">
            Explore Premium Content
          </a>
        </div>
        
        <p style="color: #666; text-align: center; margin: 30px 0; font-size: 14px;">
          Questions? Reach out to us at info@jojoprompts.com
        </p>
      </div>
      
      <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
        <p style="margin: 0;">Happy prompting!<br><strong>The JoJo Prompts Team</strong></p>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { action, orderId, planId, userId, amount, appliedDiscount } = await req.json();
    const supabaseClient = makeSupabaseClient();

    // Handle direct activation for 100% discounts
    if (action === 'direct-activation') {
      console.log('Processing direct activation for 100% discount:', { planId, userId, amount, appliedDiscount });

      if (amount !== 0) {
        throw new Error('Direct activation is only allowed for 100% discounts (amount must be $0)');
      }

      if (!appliedDiscount) {
        throw new Error('Applied discount information is required for direct activation');
      }

      // Create completed transaction record
      const { data: transaction, error: transactionError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: userId,
          plan_id: planId,
          amount_usd: 0,
          status: 'completed',
          completed_at: new Date().toISOString(),
          paypal_order_id: null, // No PayPal order for direct activation
          paypal_payment_id: `discount_${appliedDiscount.code}_${Date.now()}` // Unique identifier for discount payment
        })
        .select()
        .single();

      if (transactionError || !transaction) {
        console.error('Failed to create transaction for direct activation:', transactionError);
        throw new Error('Failed to create transaction record');
      }

      console.log('Created transaction for direct activation:', transaction);

      // Create active subscription
      const { data: subscription, error: subscriptionError } = await supabaseClient
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          payment_method: 'discount_100_percent',
          payment_id: transaction.paypal_payment_id,
          transaction_id: transaction.id,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
        })
        .select()
        .single();

      if (subscriptionError || !subscription) {
        console.error('Failed to create subscription for direct activation:', subscriptionError);
        throw new Error('Failed to create subscription');
      }

      console.log('Created subscription for direct activation:', subscription);

      // Send subscription activation email for discount activation
      await sendSubscriptionActivationEmail(supabaseClient, userId, planId, 0, 'discount_100_percent');

      // Track discount usage
      const { error: discountUsageError } = await supabaseClient
        .from('discount_code_usage')
        .insert({
          discount_code_id: appliedDiscount.id,
          user_id: userId,
          used_at: new Date().toISOString()
        });

      if (discountUsageError) {
        console.error('Failed to track discount usage:', discountUsageError);
        // Don't throw error as the main transaction succeeded
      }

      // Increment discount usage count - fixed SQL update
      const { data: currentDiscount, error: fetchError } = await supabaseClient
        .from('discount_codes')
        .select('times_used')
        .eq('id', appliedDiscount.id)
        .single();

      if (!fetchError && currentDiscount) {
        const { error: incrementError } = await supabaseClient
          .from('discount_codes')
          .update({ 
            times_used: currentDiscount.times_used + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', appliedDiscount.id);

        if (incrementError) {
          console.error('Failed to increment discount usage:', incrementError);
          // Don't throw error as the main transaction succeeded
        }
      }

      return new Response(JSON.stringify({
        success: true,
        transactionId: transaction.id,
        subscriptionId: subscription.id,
        paymentId: transaction.paypal_payment_id, // Include paymentId for success handler
        paymentMethod: 'discount_100_percent',
        status: 'COMPLETED', // Include status for success handler
        message: 'Subscription activated successfully with 100% discount'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Regular PayPal flow for non-100% discounts
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);

    if (action === 'create') {
      const siteUrl = getSiteUrl();
      
      // FIXED: Include planId and userId in both return and cancel URLs with proper encoding
      const returnUrl = `${siteUrl}/payment/callback?success=true&plan_id=${encodeURIComponent(planId)}&user_id=${encodeURIComponent(userId)}`;
      const cancelUrl = `${siteUrl}/payment/callback?success=false&plan_id=${encodeURIComponent(planId)}&user_id=${encodeURIComponent(userId)}`;

      console.log('Creating PayPal order with URLs:', { returnUrl, cancelUrl, planId, userId });

      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'USD',
              value: amount.toString()
            },
            description: `Subscription Plan Purchase`,
            // ENHANCED: Add custom data that will persist through PayPal redirect
            custom_id: `${userId}:${planId}:${Date.now()}`,
            invoice_id: `inv_${userId}_${planId}_${Date.now()}`
          }],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            user_action: 'PAY_NOW',
            payment_method: {
              payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
            }
          }
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        console.error('PayPal order creation failed:', orderData);
        throw new Error(`PayPal order creation failed: ${orderData.message}`);
      }

      // Enhanced transaction record with better metadata
      const { error: dbError } = await insertTransaction(supabaseClient, {
        userId,
        planId,
        paypalOrderId: orderData.id,
        amount
      });

      if (dbError) {
        console.error('Database error (insert transaction):', dbError);
        throw new Error('Failed to create transaction record');
      }

      console.log('PayPal order created successfully:', {
        orderId: orderData.id,
        status: orderData.status,
        customId: `${userId}:${planId}:${Date.now()}`,
        returnUrl,
        cancelUrl
      });

      return new Response(JSON.stringify({
        success: true,
        orderId: orderData.id,
        approvalUrl: orderData.links?.find((link: any) => link.rel === 'approve')?.href
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'capture') {
      if (!orderId || !userId || !planId) {
        console.error('Missing required fields for capture:', { orderId, userId, planId });
        return new Response(JSON.stringify({ success: false, error: 'Missing required fields for capture.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        console.error('PayPal capture failed:', { orderId, captureData });
        throw new Error(`PayPal capture failed: ${captureData.message}`);
      }

      const paymentId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      const paymentStatus = captureData.status;

      if (!paymentId) {
        console.error('PayPal capture: paymentId missing in response', { orderId, captureData });
        throw new Error('PayPal capture did not return a paymentId.');
      }

      console.log('PayPal payment captured:', {
        orderId,
        paymentId,
        status: paymentStatus,
        userId,
        planId
      });

      const { data: transaction, error: updateError } = await updateTransactionOnCapture(supabaseClient, {
        orderId,
        paymentId,
        paymentStatus
      });

      if (updateError || !transaction) {
        console.error('Transaction update error (on capture):', updateError, { orderId, paymentId });
        throw new Error('Failed to update transaction after capture');
      }

      if (paymentStatus === 'COMPLETED') {
        const { error: subscriptionError } = await createUserSubscription(supabaseClient, {
          userId,
          planId,
          paymentId,
          transactionId: transaction.id
        });

        if (subscriptionError) {
          console.error('Subscription creation error after capture:', subscriptionError);
          // Payment was successful - just log subscription error, don't abort
        } else {
          // Send subscription activation email for successful PayPal payment
          await sendSubscriptionActivationEmail(supabaseClient, userId, planId, transaction.amount_usd, 'PayPal');
        }
      }

      return new Response(JSON.stringify({
        success: paymentStatus === 'COMPLETED',
        status: paymentStatus,
        paymentId: paymentId,
        transactionId: transaction.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('PayPal processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
