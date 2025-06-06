
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

const CACHE_DURATION = 3600; // 1 hour
let cachedRate: number | null = null;
let cacheTimestamp = 0;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    
    // Check cache
    if (cachedRate && (now - cacheTimestamp) < CACHE_DURATION * 1000) {
      return new Response(
        JSON.stringify({
          usdToKwd: cachedRate,
          cached: true,
          timestamp: cacheTimestamp
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${CACHE_DURATION}`
          }
        }
      );
    }

    // Fetch fresh rate
    const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY');
    
    if (apiKey) {
      try {
        const response = await fetch(
          `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
          { signal: AbortSignal.timeout(10000) } // 10 second timeout
        );

        if (response.ok) {
          const data = await response.json();
          const rate = data.conversion_rates?.KWD;

          if (rate) {
            // Update cache
            cachedRate = rate;
            cacheTimestamp = now;

            return new Response(
              JSON.stringify({
                usdToKwd: rate,
                cached: false,
                timestamp: now
              }),
              {
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Cache-Control': `public, max-age=${CACHE_DURATION}`
                }
              }
            );
          }
        }
      } catch (error) {
        console.error('Exchange rate API error:', error);
      }
    }

    // Fallback to hardcoded rate
    return new Response(
      JSON.stringify({
        usdToKwd: 0.307,
        cached: false,
        fallback: true,
        error: 'Using fallback exchange rate'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // 5 minutes for fallback
        }
      }
    );
  } catch (error) {
    console.error('Exchange rate function error:', error);
    
    return new Response(
      JSON.stringify({
        usdToKwd: 0.307,
        cached: false,
        fallback: true,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      }
    );
  }
});
