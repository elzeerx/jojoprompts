import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { AbandonedCartStep1 } from './_templates/abandoned-cart-step1.tsx';
import { AbandonedCartStep2 } from './_templates/abandoned-cart-step2.tsx';
import { AbandonedCartStep3 } from './_templates/abandoned-cart-step3.tsx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AbandonedCartSequence {
  id: string;
  user_id: string;
  transaction_id: string | null;
  plan_id: string;
  plan_name: string;
  plan_price: number;
  currency: string;
  sequence_step: number;
  user_email: string;
  user_name: string | null;
  next_email_scheduled_at: string;
  status: string;
}

interface RequestBody {
  action: 'process_queue' | 'send_single' | 'start_sequence' | 'pause_sequence' | 'resume_sequence';
  sequence_id?: string;
  user_id?: string;
  plan_id?: string;
  step?: number;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://jojoprompts.com";

const resend = new Resend(RESEND_API_KEY);

async function getEmailContent(step: number, data: {
  userName: string;
  planName: string;
  planPrice: string;
  currency: string;
  checkoutUrl: string;
  discountCode?: string;
  discountPercent?: string;
}) {
  const supportEmail = "info@jojoprompts.com";
  
  let subject: string;
  let html: string;
  
  switch (step) {
    case 1:
      subject = `Complete your ${data.planName} purchase`;
      html = await renderAsync(
        React.createElement(AbandonedCartStep1, {
          userName: data.userName,
          planName: data.planName,
          planPrice: data.planPrice,
          currency: data.currency,
          checkoutUrl: data.checkoutUrl,
          supportEmail,
        })
      );
      break;
    case 2:
      subject = `Your prompts are waiting! Don't miss out 🎯`;
      html = await renderAsync(
        React.createElement(AbandonedCartStep2, {
          userName: data.userName,
          planName: data.planName,
          planPrice: data.planPrice,
          currency: data.currency,
          checkoutUrl: data.checkoutUrl,
          supportEmail,
        })
      );
      break;
    case 3:
    default:
      subject = data.discountCode 
        ? `Last chance: ${data.discountPercent}% off your ${data.planName}!`
        : `Final reminder: Your ${data.planName} is waiting`;
      html = await renderAsync(
        React.createElement(AbandonedCartStep3, {
          userName: data.userName,
          planName: data.planName,
          planPrice: data.planPrice,
          currency: data.currency,
          checkoutUrl: data.checkoutUrl,
          supportEmail,
          discountCode: data.discountCode,
          discountPercent: data.discountPercent,
        })
      );
      break;
  }
  
  return { subject, html };
}

async function sendAbandonedCartEmail(
  supabase: any,
  sequence: AbandonedCartSequence,
  step: number
) {
  console.log(`[ABANDONED_CART] Sending step ${step} email to ${sequence.user_email}`);
  
  const checkoutUrl = `${SITE_URL}/checkout?plan_id=${sequence.plan_id}&recovery=true`;
  const priceDisplay = sequence.currency === 'KWD' 
    ? `${sequence.plan_price} KWD`
    : `$${sequence.plan_price}`;
  
  // For step 3, we could add a discount code (optional feature)
  const discountCode = step === 3 ? undefined : undefined; // Can be implemented later
  const discountPercent = step === 3 ? '10' : undefined;
  
  const { subject, html } = await getEmailContent(step, {
    userName: sequence.user_name || 'there',
    planName: sequence.plan_name || 'Premium Plan',
    planPrice: priceDisplay,
    currency: sequence.currency,
    checkoutUrl,
    discountCode,
    discountPercent,
  });
  
  try {
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "JoJo Prompts <noreply@jojoprompts.com>",
      to: [sequence.user_email],
      subject,
      html,
    });
    
    if (emailError) {
      console.error(`[ABANDONED_CART] Email send failed:`, emailError);
      
      // Log failure
      await supabase.from('email_logs').insert({
        email_address: sequence.user_email,
        email_type: `abandoned_cart_step_${step}`,
        success: false,
        error_message: emailError.message,
        user_id: sequence.user_id,
      });
      
      return { success: false, error: emailError.message };
    }
    
    console.log(`[ABANDONED_CART] Email sent successfully:`, emailResult);
    
    // Log success
    await supabase.from('email_logs').insert({
      email_address: sequence.user_email,
      email_type: `abandoned_cart_step_${step}`,
      success: true,
      user_id: sequence.user_id,
      response_metadata: { resend_id: emailResult?.id },
    });
    
    // Update sequence record
    const updateData: any = {
      sequence_step: step,
      [`email_${step}_sent_at`]: new Date().toISOString(),
    };
    
    // Calculate next email schedule
    if (step === 1) {
      // Step 2 in 24 hours
      updateData.next_email_scheduled_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (step === 2) {
      // Step 3 in 48 hours (72 hours total from start)
      updateData.next_email_scheduled_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    } else {
      // After step 3, mark as expired (no more emails)
      updateData.status = 'expired';
      updateData.next_email_scheduled_at = null;
    }
    
    await supabase
      .from('abandoned_cart_sequences')
      .update(updateData)
      .eq('id', sequence.id);
    
    return { success: true, emailId: emailResult?.id };
  } catch (error) {
    console.error(`[ABANDONED_CART] Exception sending email:`, error);
    return { success: false, error: error.message };
  }
}

async function processQueue(supabase: any) {
  console.log('[ABANDONED_CART] Processing queue...');
  
  // Get all sequences that need emails sent
  const { data: sequences, error } = await supabase
    .from('abandoned_cart_sequences')
    .select('*')
    .eq('status', 'active')
    .lte('next_email_scheduled_at', new Date().toISOString())
    .order('next_email_scheduled_at', { ascending: true })
    .limit(50);
  
  if (error) {
    console.error('[ABANDONED_CART] Error fetching sequences:', error);
    return { processed: 0, errors: [error.message] };
  }
  
  if (!sequences || sequences.length === 0) {
    console.log('[ABANDONED_CART] No sequences to process');
    return { processed: 0, errors: [] };
  }
  
  console.log(`[ABANDONED_CART] Found ${sequences.length} sequences to process`);
  
  const results = {
    processed: 0,
    errors: [] as string[],
  };
  
  for (const sequence of sequences) {
    const nextStep = sequence.sequence_step + 1;
    
    // Don't send more than 3 emails
    if (nextStep > 3) {
      await supabase
        .from('abandoned_cart_sequences')
        .update({ status: 'expired' })
        .eq('id', sequence.id);
      continue;
    }
    
    const result = await sendAbandonedCartEmail(supabase, sequence, nextStep);
    
    if (result.success) {
      results.processed++;
    } else {
      results.errors.push(`${sequence.user_email}: ${result.error}`);
    }
    
    // Small delay between emails to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

async function startSequence(supabase: any, userId: string, planId: string) {
  // Get user details
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, first_name, username')
    .eq('id', userId)
    .single();
  
  if (profileError || !profile?.email) {
    return { success: false, error: 'User not found or no email' };
  }
  
  // Get plan details
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('name, price_usd')
    .eq('id', planId)
    .single();
  
  if (planError) {
    return { success: false, error: 'Plan not found' };
  }
  
  // Check if sequence already exists
  const { data: existing } = await supabase
    .from('abandoned_cart_sequences')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('status', 'active')
    .single();
  
  if (existing) {
    return { success: false, error: 'Sequence already exists' };
  }
  
  // Create new sequence
  const { data: sequence, error: insertError } = await supabase
    .from('abandoned_cart_sequences')
    .insert({
      user_id: userId,
      plan_id: planId,
      plan_name: plan.name,
      plan_price: plan.price_usd,
      user_email: profile.email,
      user_name: profile.first_name || profile.username,
      next_email_scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    })
    .select()
    .single();
  
  if (insertError) {
    return { success: false, error: insertError.message };
  }
  
  return { success: true, sequence };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RequestBody = await req.json();
    
    console.log('[ABANDONED_CART] Request:', body.action);
    
    switch (body.action) {
      case 'process_queue': {
        const result = await processQueue(supabase);
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'send_single': {
        if (!body.sequence_id || !body.step) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing sequence_id or step' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const { data: sequence, error } = await supabase
          .from('abandoned_cart_sequences')
          .select('*')
          .eq('id', body.sequence_id)
          .single();
        
        if (error || !sequence) {
          return new Response(
            JSON.stringify({ success: false, error: 'Sequence not found' }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await sendAbandonedCartEmail(supabase, sequence, body.step);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'start_sequence': {
        if (!body.user_id || !body.plan_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing user_id or plan_id' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const result = await startSequence(supabase, body.user_id, body.plan_id);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'pause_sequence': {
        if (!body.sequence_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing sequence_id' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        await supabase
          .from('abandoned_cart_sequences')
          .update({ status: 'paused' })
          .eq('id', body.sequence_id);
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      case 'resume_sequence': {
        if (!body.sequence_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing sequence_id' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        await supabase
          .from('abandoned_cart_sequences')
          .update({ 
            status: 'active',
            next_email_scheduled_at: new Date().toISOString(),
          })
          .eq('id', body.sequence_id);
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error('[ABANDONED_CART] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
