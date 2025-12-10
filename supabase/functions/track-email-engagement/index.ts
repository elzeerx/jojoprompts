import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('track-email-engagement');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface EmailEngagementData {
  email_address: string;
  action: 'opened' | 'clicked' | 'marked_as_spam';
  source?: string;
}

function getDomainFromEmail(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain || 'unknown';
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    let data: EmailEngagementData;
    
    if (req.method === 'GET') {
      // Handle tracking pixel for email opens
      const url = new URL(req.url);
      const email = url.searchParams.get('email');
      
      if (!email) {
        return new Response('Missing email parameter', { status: 400 });
      }

      data = {
        email_address: email,
        action: 'opened',
        source: 'tracking_pixel'
      };
    } else if (req.method === 'POST') {
      // Handle explicit tracking calls
      data = await req.json();
    } else {
      return new Response('Method not allowed', { status: 405 });
    }

    const { email_address, action, source } = data;

    if (!email_address || !action) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Get the domain from the email
    const domain = getDomainFromEmail(email_address);

    // Check if engagement record already exists for this email and action
    const { data: existingRecord } = await supabase
      .from('email_engagement')
      .select('*')
      .eq('email_address', email_address)
      .eq('timestamp', new Date().toISOString().split('T')[0]) // Today
      .single();

    if (existingRecord) {
      // Update existing record
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (action === 'opened') {
        updateData.email_opened = true;
      } else if (action === 'clicked') {
        updateData.link_clicked = true;
      } else if (action === 'marked_as_spam') {
        updateData.marked_as_spam = true;
      }

      const { error } = await supabase
        .from('email_engagement')
        .update(updateData)
        .eq('id', existingRecord.id);

      if (error) {
        logger.error('Error updating email engagement', { error: error.message, email: email_address });
        return new Response('Error updating engagement data', { status: 500 });
      }
    } else {
      // Create new record
      const insertData: any = {
        email_address,
        domain,
        email_opened: action === 'opened',
        link_clicked: action === 'clicked',
        marked_as_spam: action === 'marked_as_spam',
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase
        .from('email_engagement')
        .insert([insertData]);

      if (error) {
        logger.error('Error inserting email engagement', { error: error.message, email: email_address });
        return new Response('Error saving engagement data', { status: 500 });
      }
    }

    if (req.method === 'GET') {
      // Return a 1x1 transparent pixel for email opens
      const pixel = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      return new Response(pixel, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email engagement tracked successfully' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    logger.error('Email engagement tracking error', { error: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Error tracking email engagement', 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

serve(handler);