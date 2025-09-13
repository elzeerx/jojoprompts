import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAdminAccess } from "../_shared/adminAuth.ts";
import { logSecurityEvent, logAdminAction } from "../_shared/securityLogger.ts";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  rule_type: 'auto_role_assignment' | 'cleanup_inactive' | 'welcome_sequence' | 'engagement_boost';
  conditions: any;
  actions: any;
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  created_by: string;
}

interface AutomationResult {
  rule_id: string;
  affected_users: number;
  success_count: number;
  error_count: number;
  errors: string[];
  execution_time: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function executeAutoRoleAssignment(supabase: any, rule: AutomationRule): Promise<AutomationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    const { conditions, actions } = rule;
    
    // Build query based on conditions
    let query = supabase.from('profiles').select('id, role, created_at');
    
    if (conditions.min_prompts) {
      // Users with minimum number of prompts
      const { data: userPromptCounts } = await supabase
        .from('prompts')
        .select('user_id')
        .group('user_id')
        .having('count(*)', 'gte', conditions.min_prompts);
      
      if (userPromptCounts?.length) {
        const userIds = userPromptCounts.map((p: any) => p.user_id);
        query = query.in('id', userIds);
      }
    }

    if (conditions.account_age_days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - conditions.account_age_days);
      query = query.lt('created_at', cutoffDate.toISOString());
    }

    if (conditions.current_role) {
      query = query.eq('role', conditions.current_role);
    }

    const { data: eligibleUsers, error } = await query;
    
    if (error) {
      errors.push(`Query error: ${error.message}`);
      return {
        rule_id: rule.id,
        affected_users: 0,
        success_count: 0,
        error_count: 1,
        errors,
        execution_time: Date.now() - startTime
      };
    }

    // Update roles for eligible users
    for (const user of eligibleUsers || []) {
      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: actions.new_role })
          .eq('id', user.id);

        if (updateError) {
          errors.push(`Failed to update user ${user.id}: ${updateError.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        errors.push(`Exception updating user ${user.id}: ${err.message}`);
        errorCount++;
      }
    }

    return {
      rule_id: rule.id,
      affected_users: eligibleUsers?.length || 0,
      success_count: successCount,
      error_count: errorCount,
      errors,
      execution_time: Date.now() - startTime
    };

  } catch (error) {
    return {
      rule_id: rule.id,
      affected_users: 0,
      success_count: 0,
      error_count: 1,
      errors: [`Rule execution error: ${error.message}`],
      execution_time: Date.now() - startTime
    };
  }
}

async function executeCleanupInactive(supabase: any, rule: AutomationRule): Promise<AutomationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    const { conditions, actions } = rule;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - conditions.inactive_days);

    // Find inactive users
    const { data: inactiveUsers } = await supabase
      .from('profiles')
      .select('id, username')
      .lt('created_at', cutoffDate.toISOString())
      .not('id', 'in', supabase
        .from('prompt_usage_history')
        .select('user_id')
        .gte('created_at', cutoffDate.toISOString())
      );

    if (actions.action_type === 'archive') {
      // Archive users (set inactive flag)
      for (const user of inactiveUsers || []) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              membership_tier: 'archived',
              bio: (user.bio || '') + ' [ARCHIVED - INACTIVE]'
            })
            .eq('id', user.id);

          if (error) {
            errors.push(`Failed to archive user ${user.id}: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`Exception archiving user ${user.id}: ${err.message}`);
          errorCount++;
        }
      }
    }

    return {
      rule_id: rule.id,
      affected_users: inactiveUsers?.length || 0,
      success_count: successCount,
      error_count: errorCount,
      errors,
      execution_time: Date.now() - startTime
    };

  } catch (error) {
    return {
      rule_id: rule.id,
      affected_users: 0,
      success_count: 0,
      error_count: 1,
      errors: [`Cleanup execution error: ${error.message}`],
      execution_time: Date.now() - startTime
    };
  }
}

async function executeRule(supabase: any, rule: AutomationRule): Promise<AutomationResult> {
  switch (rule.rule_type) {
    case 'auto_role_assignment':
      return executeAutoRoleAssignment(supabase, rule);
    case 'cleanup_inactive':
      return executeCleanupInactive(supabase, rule);
    default:
      return {
        rule_id: rule.id,
        affected_users: 0,
        success_count: 0,
        error_count: 1,
        errors: [`Unknown rule type: ${rule.rule_type}`],
        execution_time: 0
      };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(authHeader);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authResult = await verifyAdminAccess(supabaseAdmin, user.id, 'automation:manage');
    if (!authResult.success) {
      await logSecurityEvent(supabaseAdmin, {
        user_id: user.id,
        action: 'unauthorized_automation_access',
        details: { error: authResult.error }
      });

      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, rule_id, rules } = body;

    let responseData;

    switch (action) {
      case 'execute_rule':
        if (!rule_id) {
          return new Response(JSON.stringify({ error: 'Rule ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get rule details (mock for now)
        const mockRule: AutomationRule = {
          id: rule_id,
          name: 'Auto Promote Active Users',
          description: 'Promote users to prompter role after 10 prompts',
          rule_type: 'auto_role_assignment',
          conditions: { min_prompts: 10, current_role: 'user' },
          actions: { new_role: 'prompter' },
          is_active: true,
          last_run: null,
          next_run: null,
          created_by: user.id
        };

        responseData = await executeRule(supabaseAdmin, mockRule);
        
        await logAdminAction(supabaseAdmin, user.id, 'automation_rule_executed', 'automation_rules', {
          rule_id,
          result: responseData
        });
        break;

      case 'execute_all':
        // Execute all active rules (mock response)
        responseData = {
          executed_rules: 2,
          total_affected_users: 15,
          total_success: 13,
          total_errors: 2,
          results: [
            {
              rule_id: 'rule_1',
              affected_users: 8,
              success_count: 8,
              error_count: 0,
              errors: [],
              execution_time: 1250
            },
            {
              rule_id: 'rule_2',
              affected_users: 7,
              success_count: 5,
              error_count: 2,
              errors: ['User not found', 'Permission denied'],
              execution_time: 890
            }
          ]
        };
        
        await logAdminAction(supabaseAdmin, user.id, 'automation_batch_executed', 'automation_rules', {
          executed_count: responseData.executed_rules,
          total_affected: responseData.total_affected_users
        });
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
      success: true,
      data: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in automated user management:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});