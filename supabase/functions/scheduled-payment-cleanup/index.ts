import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('scheduled-payment-cleanup');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    logger.info('Starting scheduled payment cleanup');

    // Call the auto-capture function
    const { data: captureResult, error: captureError } = await supabase.functions.invoke('auto-capture-paypal', {
      body: {}
    });

    if (captureError) {
      logger.error('Error in auto-capture', { error: captureError });
      throw captureError;
    }

    logger.info('Auto-capture completed', { result: captureResult });

    // Clean up very old pending transactions (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: oldTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, paypal_order_id, created_at')
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (fetchError) {
      logger.error('Error fetching old transactions', { error: fetchError });
    } else if (oldTransactions && oldTransactions.length > 0) {
      logger.info('Found old transactions to mark as expired', { count: oldTransactions.length });
      
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          error_message: 'Transaction expired - older than 7 days',
          completed_at: new Date().toISOString()
        })
        .in('id', oldTransactions.map(tx => tx.id));

      if (updateError) {
        logger.error('Error updating old transactions', { error: updateError });
      } else {
        logger.info('Successfully marked old transactions as expired', { count: oldTransactions.length });
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
    logger.error('Scheduled cleanup error', { error });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});