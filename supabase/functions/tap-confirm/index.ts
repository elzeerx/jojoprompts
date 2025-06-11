
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log('Tap confirm received:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const tapSecretKey = Deno.env.get('TAP_SECRET_KEY')!
    
    // Get charge ID from request body
    const { charge_id } = await req.json()
    
    if (!charge_id) {
      return new Response(
        JSON.stringify({ error: 'Missing charge_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Confirming charge status for:', charge_id)
    
    // Fetch charge status from Tap API
    const tapResponse = await fetch(`https://api.tap.company/v2/charges/${charge_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tapSecretKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!tapResponse.ok) {
      console.error('Tap API error:', tapResponse.status, tapResponse.statusText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch charge status' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const chargeData = await tapResponse.json()
    console.log('Charge data from Tap:', JSON.stringify(chargeData, null, 2))
    
    // Return simplified status
    const status = chargeData.status || 'PENDING'
    
    return new Response(
      JSON.stringify({ status }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Charge confirmation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
