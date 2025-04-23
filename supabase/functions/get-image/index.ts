
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

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
      console.error("Path format error: Could not find '/get-image/' in path:", rawPath);
    }
    
    const imagePath = decodeURIComponent(rawPath);
    const width = url.searchParams.get('width') || '400';
    const quality = url.searchParams.get('quality') || '80';
    
    console.log(`Processing image request for: ${imagePath} (width: ${width}, quality: ${quality})`);
    console.log(`Full URL was: ${req.url}`);
    
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
      console.error('Error fetching image:', error);
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
    
    console.log(`Successfully retrieved image: ${imagePath} (${contentType}, ${imageData.byteLength} bytes)`);

    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...corsHeaders,
      }
    });
  } catch (err) {
    console.error('Error in get-image function:', err);
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
