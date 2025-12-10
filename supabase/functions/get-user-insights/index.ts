import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-user-insights');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserInsightsRequest {
  email: string;
}

interface UserInsights {
  daysSinceSignup: number;
  recommendedPlan: string;
  userTier: string;
  personalizedMessage: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  recommendationReason: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Function started");

    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      throw new Error("Insufficient permissions");
    }

    const { email }: UserInsightsRequest = await req.json();

    logger.info("Getting user insights", { email });

    // Find the user by email
    const { data: targetUser, error: targetUserError } = await supabaseClient.auth.admin.listUsers();
    if (targetUserError) throw new Error(`Failed to fetch users: ${targetUserError.message}`);

    const foundUser = targetUser.users.find(u => u.email === email);
    if (!foundUser) {
      throw new Error(`User not found with email: ${email}`);
    }

    // Get user profile data
    const { data: userProfile, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", foundUser.id)
      .single();

    // Calculate days since signup
    const signupDate = new Date(foundUser.created_at);
    const now = new Date();
    const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check current subscription status
    const { data: currentSubscription } = await supabaseClient
      .from("user_subscriptions")
      .select("*, subscription_plans(*)")
      .eq("user_id", foundUser.id)
      .eq("status", "active")
      .single();

    // Get user activity/usage data
    const { data: promptUsage } = await supabaseClient
      .from("prompt_usage_history")
      .select("*")
      .eq("user_id", foundUser.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: favorites } = await supabaseClient
      .from("favorites")
      .select("*")
      .eq("user_id", foundUser.id);

    const { data: collections } = await supabaseClient
      .from("collections")
      .select("*")
      .eq("user_id", foundUser.id);

    // Analyze user behavior and generate insights
    const insights: UserInsights = generateUserInsights({
      daysSinceSignup,
      currentSubscription,
      promptUsage: promptUsage || [],
      favoritesCount: favorites?.length || 0,
      collectionsCount: collections?.length || 0,
      userProfile,
      firstName: userProfile?.first_name || 'there'
    });

    logger.info("User insights generated", { 
      userId: foundUser.id, 
      daysSinceSignup, 
      recommendedPlan: insights.recommendedPlan 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        insights,
        userInfo: {
          email,
          firstName: userProfile?.first_name || '',
          lastName: userProfile?.last_name || '',
          signupDate: foundUser.created_at,
          daysSinceSignup
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logger.error("Error in get-user-insights", { error: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

function generateUserInsights(data: {
  daysSinceSignup: number;
  currentSubscription: any;
  promptUsage: any[];
  favoritesCount: number;
  collectionsCount: number;
  userProfile: any;
  firstName: string;
}): UserInsights {
  const { 
    daysSinceSignup, 
    currentSubscription, 
    promptUsage, 
    favoritesCount, 
    collectionsCount,
    firstName 
  } = data;

  // Determine user engagement level
  const isHighlyEngaged = promptUsage.length > 5 || favoritesCount > 3 || collectionsCount > 1;
  const isModeratelyEngaged = promptUsage.length > 2 || favoritesCount > 0;
  
  // Determine urgency based on signup time
  let urgencyLevel: 'low' | 'medium' | 'high' = 'low';
  if (daysSinceSignup <= 7) urgencyLevel = 'high';
  else if (daysSinceSignup <= 30) urgencyLevel = 'medium';

  // If user already has a subscription, recommend upgrade
  if (currentSubscription) {
    return {
      daysSinceSignup,
      recommendedPlan: "Premium",
      userTier: "existing_subscriber",
      personalizedMessage: `You've been exploring our ${currentSubscription.subscription_plans?.name || 'current'} plan for ${daysSinceSignup} days. Ready to unlock even more possibilities?`,
      urgencyLevel: 'low',
      recommendationReason: "Upgrade to access our complete prompt library and exclusive features."
    };
  }

  // Recommend based on engagement and time
  if (isHighlyEngaged) {
    return {
      daysSinceSignup,
      recommendedPlan: "Pro",
      userTier: "power_user",
      personalizedMessage: daysSinceSignup <= 7 
        ? `Wow! You've been actively using JojoPrompts for ${daysSinceSignup} day${daysSinceSignup === 1 ? '' : 's'} with ${promptUsage.length} prompt uses and ${favoritesCount} favorites. You're clearly serious about AI!`
        : `Over the past ${daysSinceSignup} days, you've used ${promptUsage.length} prompts and saved ${favoritesCount} favorites. You're getting real value from our platform!`,
      urgencyLevel,
      recommendationReason: "Based on your high engagement, our Pro plan will give you unlimited access to premium prompts and priority support."
    };
  }

  if (isModeratelyEngaged) {
    return {
      daysSinceSignup,
      recommendedPlan: "Starter",
      userTier: "engaged_user",
      personalizedMessage: daysSinceSignup <= 7
        ? `Great start! In just ${daysSinceSignup} day${daysSinceSignup === 1 ? '' : 's'}, you've already explored our platform and found prompts you like.`
        : `You've been with us for ${daysSinceSignup} days and have started building your prompt collection. That's fantastic!`,
      urgencyLevel,
      recommendationReason: "Our Starter plan is perfect for users like you who are actively exploring AI prompts."
    };
  }

  // Low engagement users
  return {
    daysSinceSignup,
    recommendedPlan: "Starter",
    userTier: "new_user",
    personalizedMessage: daysSinceSignup <= 3
      ? `Welcome to JojoPrompts! You joined ${daysSinceSignup} day${daysSinceSignup === 1 ? '' : 's'} ago - perfect timing to explore what we have to offer.`
      : `It's been ${daysSinceSignup} days since you joined JojoPrompts. We'd love to help you discover the perfect prompts for your needs!`,
    urgencyLevel,
    recommendationReason: "Start with our Starter plan to explore thousands of quality AI prompts at an affordable price."
  };
}

serve(handler);