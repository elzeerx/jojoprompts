
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache duration in seconds - 7 days for images
const CACHE_DURATION = 7 * 24 * 60 * 60;

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
      return new Response(JSON.stringify({ error: 'Invalid path format' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }
    
    const imagePath = decodeURIComponent(rawPath);
    const width = url.searchParams.get('width') || '400';
    const quality = url.searchParams.get('quality') || '80';
    const format = url.searchParams.get('format') || 'webp'; // Default to WebP for better compression
    
    console.log(`Processing image request for: ${imagePath} (width: ${width}, quality: ${quality}, format: ${format})`);
    
    // Create a Supabase client using the service role key for internal operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    if (!imagePath) {
      throw new Error('Image path is missing or invalid');
    }

    // Check if we have a client-side cache hit
    const ifNoneMatch = req.headers.get('if-none-match');
    const cacheKey = `${imagePath}-w${width}-q${quality}-${format}`;
    const etag = `"${cacheKey}"`;

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304, // Not Modified
        headers: {
          ...corsHeaders,
          'Cache-Control': `public, max-age=${CACHE_DURATION}, immutable`,
          'ETag': etag,
        }
      });
    }

    // Download image from private bucket with transformation
    const { data, error } = await supabaseAdmin
      .storage
      .from('prompt-images')
      .download(imagePath, {
        transform: {
          width: parseInt(width),
          quality: parseInt(quality),
          format: format as 'webp' | 'jpeg' | 'png', // Type cast for accepted formats
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

    // Return the image with appropriate content type and caching headers
    const imageData = await data.arrayBuffer();
    // Set the correct content type based on the requested format
    let contentType = 'image/jpeg';
    if (format === 'webp') contentType = 'image/webp';
    if (format === 'png') contentType = 'image/png';
    
    console.log(`Successfully retrieved image: ${imagePath} (${contentType}, ${imageData.byteLength} bytes)`);

    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_DURATION}, immutable`,
        'ETag': etag,
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
