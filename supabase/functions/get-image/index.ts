import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-image');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the path and query parameters
    const url = new URL(req.url);
    
    // Extract the path more reliably by getting everything after get-image
    let rawPath = url.pathname;
    const getImageIndex = rawPath.indexOf('/get-image/');
    if (getImageIndex !== -1) {
      rawPath = rawPath.substring(getImageIndex + '/get-image/'.length);
    } else {
      logger.error("Path format error: Could not find '/get-image/' in path", { rawPath });
      return new Response(JSON.stringify({ error: 'Invalid path format' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }
    
    const imagePath = decodeURIComponent(rawPath);
    const width = url.searchParams.get('width') || '400';
    const quality = url.searchParams.get('quality') || '80';
    
    logger.info('Processing image request', { imagePath, width, quality });
    
    // Create a Supabase client using the service role key for internal operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    if (!imagePath) {
      throw new Error('Image path is missing or invalid');
    }

    // Download image from private bucket
    const { data, error } = await supabaseAdmin
      .storage
      .from('prompt-images')
      .download(imagePath, {
        transform: {
          width: parseInt(width),
          quality: parseInt(quality),
        },
      });

    if (error) {
      logger.error('Error fetching image', { error: error.message, imagePath });
      return new Response(
        JSON.stringify({ error: 'Failed to fetch image', details: error.message, path: imagePath }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Return the image with appropriate content type
    const imageData = await data.arrayBuffer();
    const contentType = data.type || 'image/jpeg';
    
    logger.info('Successfully retrieved image', { 
      imagePath, 
      contentType, 
      sizeBytes: imageData.byteLength 
    });

    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...corsHeaders,
      }
    });
  } catch (err) {
    logger.error('Error in get-image function', { error: err });
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: err.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});
