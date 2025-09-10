
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse query parameters
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const statusFilter = url.searchParams.get('status')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const offset = (page - 1) * limit

    // Build the query using Supabase client
    let query = supabase
      .from('transactions')
      .select(`
        id,
        user_id,
        plan_id,
        amount_usd,
        status,
        created_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: transactions, error: queryError, count } = await query

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user data for each transaction
    const userIds = [...new Set(transactions?.map(t => t.user_id) || [])]
    const planIds = [...new Set(transactions?.map(t => t.plan_id) || [])]
    
    const { data: users } = await supabase.auth.admin.listUsers()
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds)
    
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('id, name')
      .in('id', planIds)

    // Create user lookup maps
    const userEmailMap = new Map()
    const profileMap = new Map()
    const planMap = new Map()

    users?.users?.forEach(user => {
      userEmailMap.set(user.id, user.email)
    })

    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    plans?.forEach(plan => {
      planMap.set(plan.id, plan)
    })

    // Format the response data
    const formattedTransactions = transactions?.map(transaction => {
      const userEmail = userEmailMap.get(transaction.user_id)
      const profile = profileMap.get(transaction.user_id)
      const plan = planMap.get(transaction.plan_id)
      const displayName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''
      
      return {
        id: transaction.id,
        user_id: transaction.user_id,
        amount_usd: transaction.amount_usd,
        status: transaction.status,
        created_at: transaction.created_at,
        user_email: userEmail || displayName || 'Unknown User',
        plan: {
          name: plan?.name || 'Unknown Plan'
        }
      }
    }) || []

    return new Response(
      JSON.stringify({
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-admin-transactions:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
