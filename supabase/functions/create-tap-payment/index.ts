
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log('Create Tap payment received:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const tapSecretKey = Deno.env.get('TAP_SECRET_KEY')!
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://fxkqgjakbyrxkmevkglv.supabase.co'
    
    const { planId, userId, amount, currency = 'USD' } = await req.json()
    
    if (!planId || !userId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Creating Tap payment:', { planId, userId, amount, currency })
    
    // Generate idempotency key to prevent duplicate charges
    const idempotencyKey = `${userId}-${planId}-${Date.now()}`
    
    const tapPayload = {
      amount: amount,
      currency: currency,
      threeDSecure: true,
      save_card: false,
      description: `Subscription for plan ${planId}`,
      metadata: {
        user_id: userId,
        plan_id: planId
      },
      reference: {
        transaction: idempotencyKey,
        order: `order-${userId}-${Date.now()}`
      },
      receipt: {
        email: false,
        sms: false
      },
      customer: {
        first_name: "Customer",
        last_name: "User",
        email: "customer@example.com"
      },
      merchant: {
        id: ""
      },
      source: {
        id: "src_all"
      },
      post: {
        url: `${frontendUrl}/functions/v1/tap-webhook`
      },
      redirect: {
        url: `${frontendUrl}/payment-handler`
      }
    }
    
    console.log('Sending request to Tap API with payload:', JSON.stringify(tapPayload, null, 2))
    
    const tapResponse = await fetch('https://api.tap.company/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tapSecretKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(tapPayload)
    })
    
    const responseData = await tapResponse.json()
    console.log('Tap API response:', JSON.stringify(responseData, null, 2))
    
    if (!tapResponse.ok) {
      console.error('Tap API error:', tapResponse.status, responseData)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment charge', details: responseData }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify(responseData), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Payment creation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
