
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Rate limiting function
function isRateLimited(identifier: string, maxRequests = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (record.count >= maxRequests) {
    return true;
  }
  
  record.count++;
  return false;
}

// Input validation
function validateChargeId(chargeId: string): boolean {
  if (!chargeId || typeof chargeId !== 'string') return false;
  if (chargeId.length < 5 || chargeId.length > 100) return false;
  // Basic pattern check for Tap charge IDs
  return /^[a-zA-Z0-9_-]+$/.test(chargeId);
}

Deno.serve(async (req) => {
  console.log('Tap confirm received:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const tapSecretKey = Deno.env.get('TAP_SECRET_KEY')!
    
    if (!tapSecretKey) {
      console.error('TAP_SECRET_KEY not configured')
      return new Response('Configuration error', { status: 500, headers: corsHeaders })
    }
    
    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(clientIp)) {
      console.warn('Rate limit exceeded for IP:', clientIp);
      return new Response('Rate limit exceeded', { status: 429, headers: corsHeaders });
    }
    
    // Get and validate charge ID from request body
    const requestBody = await req.text();
    let parsedBody;
    
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON format' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { charge_id } = parsedBody;
    
    if (!validateChargeId(charge_id)) {
      console.error('Invalid charge_id format:', charge_id);
      return new Response(
        JSON.stringify({ error: 'Invalid charge_id format' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Confirming charge status for:', charge_id)
    
    // Fetch charge status from Tap API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const tapResponse = await fetch(`https://api.tap.company/v2/charges/${charge_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tapSecretKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!tapResponse.ok) {
        console.error('Tap API error:', tapResponse.status, tapResponse.statusText)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch charge status from Tap API' }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const chargeData = await tapResponse.json()
      console.log('Charge data from Tap:', JSON.stringify(chargeData, null, 2))
      
      // Validate and sanitize response
      const status = typeof chargeData.status === 'string' ? chargeData.status.toUpperCase() : 'UNKNOWN';
      
      // Return simplified status with allowed values only
      const allowedStatuses = ['CAPTURED', 'FAILED', 'PENDING', 'CANCELLED', 'UNKNOWN'];
      const finalStatus = allowedStatuses.includes(status) ? status : 'UNKNOWN';
      
      return new Response(
        JSON.stringify({ status: finalStatus }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('Tap API request timeout');
        return new Response(
          JSON.stringify({ error: 'Request timeout' }), 
          { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Tap API request error:', error);
      return new Response(
        JSON.stringify({ error: 'Network error while fetching charge status' }), 
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('Charge confirmation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
