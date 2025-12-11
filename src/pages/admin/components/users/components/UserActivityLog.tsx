import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Activity, 
  User, 
  Shield, 
  CreditCard, 
  Mail, 
  Trash2, 
  Edit, 
  RefreshCw,
  Search,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActivityLogEntry {
  id: string;
  admin_user_id: string;
  action: string;
  target_resource: string;
  metadata: Record<string, any> | null;
  timestamp: string;
  anonymized_ip: string | null;
}

const actionIcons: Record<string, typeof Activity> = {
  'user_created': User,
  'user_updated': Edit,
  'user_deleted': Trash2,
  'role_changed': Shield,
  'subscription_assigned': CreditCard,
  'subscription_cancelled': CreditCard,
  'email_sent': Mail,
  'password_reset': Shield,
  'email_confirmed': Mail,
  'bulk_confirm': Mail,
  'sensitive_data_access': Shield,
  'profile_access_attempt': User,
  'default': Activity,
};

const actionColors: Record<string, string> = {
  'user_created': 'bg-green-100 text-green-700 border-green-200',
  'user_updated': 'bg-blue-100 text-blue-700 border-blue-200',
  'user_deleted': 'bg-red-100 text-red-700 border-red-200',
  'role_changed': 'bg-purple-100 text-purple-700 border-purple-200',
  'subscription_assigned': 'bg-warm-gold/10 text-warm-gold border-warm-gold/20',
  'subscription_cancelled': 'bg-orange-100 text-orange-700 border-orange-200',
  'email_sent': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'password_reset': 'bg-amber-100 text-amber-700 border-amber-200',
  'email_confirmed': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'default': 'bg-gray-100 text-gray-600 border-gray-200',
};

export function UserActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      // Cast metadata to the expected type
      const typedData = (data || []).map(item => ({
        ...item,
        metadata: item.metadata as Record<string, any> | null
      }));
      setLogs(typedData);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  const getIcon = (action: string) => {
    const Icon = actionIcons[action] || actionIcons.default;
    return Icon;
  };

  const getColor = (action: string) => {
    return actionColors[action] || actionColors.default;
  };

  const formatMetadata = (metadata: Record<string, any> | null) => {
    if (!metadata) return null;
    
    const displayItems: string[] = [];
    if (metadata.target_user_id) displayItems.push(`User: ${metadata.target_user_id.slice(0, 8)}...`);
    if (metadata.email) displayItems.push(`Email: ${metadata.email}`);
    if (metadata.role) displayItems.push(`Role: ${metadata.role}`);
    if (metadata.plan_name) displayItems.push(`Plan: ${metadata.plan_name}`);
    if (metadata.reason) displayItems.push(`Reason: ${metadata.reason}`);
    
    return displayItems.length > 0 ? displayItems.join(' • ') : null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Activity Log
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {action.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const Icon = getIcon(log.action);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${getColor(log.action)}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${getColor(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.target_resource}
                        </span>
                      </div>
                      {formatMetadata(log.metadata) && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {formatMetadata(log.metadata)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                        {log.anonymized_ip && ` • IP: ${log.anonymized_ip}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
