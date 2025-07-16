import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = (...args: any[]) => console.log(`[SCHEDULED-CLEANUP][${new Date().toISOString()}]`, ...args);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logger('Starting scheduled payment cleanup');

    // Call the auto-capture function
    const { data: captureResult, error: captureError } = await supabase.functions.invoke('auto-capture-paypal', {
      body: {}
    });

    if (captureError) {
      logger('Error in auto-capture:', captureError);
      throw captureError;
    }

    logger('Auto-capture completed:', captureResult);

    // Clean up very old pending transactions (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: oldTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, paypal_order_id, created_at')
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (fetchError) {
      logger('Error fetching old transactions:', fetchError);
    } else if (oldTransactions && oldTransactions.length > 0) {
      logger(`Found ${oldTransactions.length} transactions older than 7 days, marking as expired`);
      
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          error_message: 'Transaction expired - older than 7 days',
          completed_at: new Date().toISOString()
        })
        .in('id', oldTransactions.map(tx => tx.id));

      if (updateError) {
        logger('Error updating old transactions:', updateError);
      } else {
        logger(`Successfully marked ${oldTransactions.length} old transactions as expired`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled cleanup completed',
      autoCapture: captureResult,
      expiredOldTransactions: oldTransactions?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger('Scheduled cleanup error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});