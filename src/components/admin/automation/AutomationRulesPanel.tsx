import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Bot, 
  Clock, 
  Users, 
  UserCog, 
  Trash2,
  Mail,
  Settings,
  Play,
  Pause,
  Plus,
  Edit,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  execution_count: number;
  success_rate: number;
}

export function AutomationRulesPanel() {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Auto Promote Active Users',
      description: 'Automatically promote users to prompter role after creating 10+ prompts',
      rule_type: 'auto_role_assignment',
      conditions: { min_prompts: 10, current_role: 'user', account_age_days: 7 },
      actions: { new_role: 'prompter' },
      is_active: true,
      last_run: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      next_run: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
      created_by: 'admin',
      execution_count: 15,
      success_rate: 94.2
    },
    {
      id: '2',
      name: 'Cleanup Inactive Users',
      description: 'Archive users who have been inactive for 90+ days',
      rule_type: 'cleanup_inactive',
      conditions: { inactive_days: 90 },
      actions: { action_type: 'archive' },
      is_active: true,
      last_run: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      next_run: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: 'admin',
      execution_count: 8,
      success_rate: 100
    },
    {
      id: '3',
      name: 'Welcome Email Sequence',
      description: 'Send welcome emails to new users after 24 hours',
      rule_type: 'welcome_sequence',
      conditions: { account_age_hours: 24, no_activity: true },
      actions: { email_template: 'welcome_series' },
      is_active: false,
      last_run: null,
      next_run: null,
      created_by: 'admin',
      execution_count: 0,
      success_rate: 0
    }
  ]);

  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [executingRules, setExecutingRules] = useState<Set<string>>(new Set());

  const executeRule = async (ruleId: string) => {
    setExecutingRules(prev => new Set(prev).add(ruleId));
    
    try {
      const { data, error } = await supabase.functions.invoke('automated-user-management', {
        body: { 
          action: 'execute_rule',
          rule_id: ruleId
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        const result = data.data;
        
        // Update rule last run time
        setRules(prev => prev.map(rule => 
          rule.id === ruleId 
            ? { 
                ...rule, 
                last_run: new Date().toISOString(),
                execution_count: rule.execution_count + 1,
                success_rate: Math.round(((rule.success_rate * rule.execution_count) + 
                  (result.success_count / (result.success_count + result.error_count)) * 100) / 
                  (rule.execution_count + 1) * 100) / 100
              }
            : rule
        ));

        toast({
          title: 'Rule Executed',
          description: `Processed ${result.affected_users} users. ${result.success_count} successful, ${result.error_count} errors.`
        });
      } else {
        throw new Error(data?.error || 'Failed to execute rule');
      }
    } catch (error: any) {
      console.error('Error executing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute automation rule',
        variant: 'destructive'
      });
    } finally {
      setExecutingRules(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, is_active: !rule.is_active }
        : rule
    ));
    
    const rule = rules.find(r => r.id === ruleId);
    toast({
      title: rule?.is_active ? 'Rule Disabled' : 'Rule Enabled',
      description: `${rule?.name} has been ${rule?.is_active ? 'disabled' : 'enabled'}`
    });
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'auto_role_assignment': return <UserCog className="h-4 w-4" />;
      case 'cleanup_inactive': return <Trash2 className="h-4 w-4" />;
      case 'welcome_sequence': return <Mail className="h-4 w-4" />;
      case 'engagement_boost': return <Target className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'auto_role_assignment': return 'Role Assignment';
      case 'cleanup_inactive': return 'Cleanup';
      case 'welcome_sequence': return 'Welcome Email';
      case 'engagement_boost': return 'Engagement';
      default: return type;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Automation Rules</h2>
          <p className="text-muted-foreground">Automated user management and engagement</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Automation Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input id="rule-name" placeholder="Enter rule name..." />
              </div>
              <div>
                <Label htmlFor="rule-description">Description</Label>
                <Textarea id="rule-description" placeholder="Describe what this rule does..." />
              </div>
              <div>
                <Label htmlFor="rule-type">Rule Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_role_assignment">Auto Role Assignment</SelectItem>
                    <SelectItem value="cleanup_inactive">Cleanup Inactive Users</SelectItem>
                    <SelectItem value="welcome_sequence">Welcome Email Sequence</SelectItem>
                    <SelectItem value="engagement_boost">Engagement Boost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  setIsCreating(false);
                  toast({ title: 'Success', description: 'Automation rule created' });
                }}>
                  Create Rule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} className={`transition-all ${rule.is_active ? 'border-primary/20' : 'border-muted'}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    {getRuleIcon(rule.rule_type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {getRuleTypeLabel(rule.rule_type)}
                      </Badge>
                      <Badge variant={rule.is_active ? 'default' : 'outline'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeRule(rule.id)}
                    disabled={executingRules.has(rule.id) || !rule.is_active}
                  >
                    {executingRules.has(rule.id) ? (
                      <>
                        <Settings className="h-4 w-4 mr-2 animate-spin" />
                        Running
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Execute
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Executions</p>
                  <p className="text-2xl font-bold">{rule.execution_count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Success Rate</p>
                  <p className={`text-2xl font-bold ${getSuccessRateColor(rule.success_rate)}`}>
                    {rule.success_rate}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Last Run</p>
                  <p className="text-sm text-muted-foreground">
                    {rule.last_run ? (
                      formatDistanceToNow(new Date(rule.last_run), { addSuffix: true })
                    ) : (
                      'Never'
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Next Run</p>
                  <p className="text-sm text-muted-foreground">
                    {rule.next_run && rule.is_active ? (
                      formatDistanceToNow(new Date(rule.next_run), { addSuffix: true })
                    ) : (
                      'Not scheduled'
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <details className="cursor-pointer">
                  <summary className="text-sm font-medium mb-2">Rule Configuration</summary>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Conditions:</span>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(rule.conditions, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="font-medium">Actions:</span>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(rule.actions, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Automation Rules</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first automation rule to start managing users automatically
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}