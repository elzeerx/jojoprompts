import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  User,
  Edit,
  Mail,
  Shield,
  ChevronDown,
  ChevronRight,
  Eye,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ActivityEntry {
  id: string;
  action: string;
  field_name: string | null;
  old_value: any;
  new_value: any;
  admin_first_name: string;
  admin_last_name: string;
  admin_username: string;
  timestamp: string;
  metadata: any;
}

interface UserActivityTimelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function UserActivityTimeline({
  open,
  onOpenChange,
  userId,
  userName
}: UserActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (open && userId) {
      loadActivityTimeline();
    }
  }, [open, userId]);

  const loadActivityTimeline = async (pageOffset: number = 0) => {
    if (loading) return;
    
    setLoading(true);
    try {
      // For now, we'll use a simple query to get admin audit logs for this user
      // This will be replaced with the proper RPC function once it's available
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select(`
          id,
          action,
          target_resource,
          metadata,
          timestamp,
          admin_user_id,
          profiles!admin_user_id(first_name, last_name, username)
        `)
        .eq('metadata->>target_user_id', userId)
        .order('timestamp', { ascending: false })
        .range(pageOffset, pageOffset + 19);

      if (error) {
        console.error('Error loading activity timeline:', error);
        toast({
          title: "Error loading activity",
          description: "Failed to load user activity timeline.",
          variant: "destructive"
        });
        return;
      }

      const formattedData: ActivityEntry[] = (data || []).map((item: any) => ({
        id: item.id,
        action: item.action,
        field_name: item.metadata?.field_name || null,
        old_value: item.metadata?.old_value || null,
        new_value: item.metadata?.new_value || null,
        admin_first_name: item.profiles?.first_name || 'Unknown',
        admin_last_name: item.profiles?.last_name || 'Admin',
        admin_username: item.profiles?.username || 'unknown',
        timestamp: item.timestamp,
        metadata: item.metadata || {}
      }));

      if (pageOffset === 0) {
        setActivities(formattedData);
      } else {
        setActivities(prev => [...prev, ...formattedData]);
      }

      setHasMore(formattedData.length === 20);
      setPage(pageOffset);
    } catch (error) {
      console.error('Activity timeline error:', error);
      toast({
        title: "Error",
        description: "Failed to load activity timeline.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadActivityTimeline(page + 20);
    }
  };

  const toggleEntryExpansion = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'update_profile':
      case 'profile_update':
        return <Edit className="h-4 w-4" />;
      case 'update_email':
      case 'email_update':
        return <Mail className="h-4 w-4" />;
      case 'role_change':
      case 'update_role':
        return <Shield className="h-4 w-4" />;
      case 'account_status_change':
        return <User className="h-4 w-4" />;
      case 'profile_view':
      case 'sensitive_data_access':
        return <Eye className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'update_profile':
      case 'profile_update':
        return 'bg-blue-100 text-blue-800';
      case 'update_email':
      case 'email_update':
        return 'bg-green-100 text-green-800';
      case 'role_change':
      case 'update_role':
        return 'bg-purple-100 text-purple-800';
      case 'account_status_change':
        return 'bg-orange-100 text-orange-800';
      case 'profile_view':
      case 'sensitive_data_access':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatActionTitle = (action: string, fieldName: string | null) => {
    if (fieldName) {
      const field = fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `${field} Updated`;
    }
    
    switch (action) {
      case 'update_profile':
      case 'profile_update':
        return 'Profile Updated';
      case 'update_email':
      case 'email_update':
        return 'Email Updated';
      case 'role_change':
      case 'update_role':
        return 'Role Changed';
      case 'account_status_change':
        return 'Account Status Changed';
      case 'profile_view':
        return 'Profile Viewed';
      case 'sensitive_data_access':
        return 'Sensitive Data Accessed';
      default:
        return action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Timeline - {userName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4">
            {activities.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity records found for this user.</p>
              </div>
            )}

            {activities.map((activity, index) => {
              const isExpanded = expandedEntries.has(activity.id);
              const showDetails = activity.old_value || activity.new_value || activity.metadata;

              return (
                <div
                  key={activity.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-full ${getActionColor(activity.action)}`}>
                        {getActionIcon(activity.action)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">
                            {formatActionTitle(activity.action, activity.field_name)}
                          </h4>
                          {activity.field_name && (
                            <Badge variant="outline" className="text-xs">
                              {activity.field_name}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          Modified by {activity.admin_first_name} {activity.admin_last_name} 
                          (@{activity.admin_username})
                        </p>
                        
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(activity.timestamp)}
                        </p>

                        {showDetails && isExpanded && (
                          <div className="mt-3 p-3 bg-muted rounded-lg">
                            {activity.old_value && (
                              <div className="mb-2">
                                <span className="text-xs font-medium text-red-600">Previous Value:</span>
                                <pre className="text-xs mt-1 whitespace-pre-wrap">
                                  {formatValue(activity.old_value)}
                                </pre>
                              </div>
                            )}
                            
                            {activity.new_value && (
                              <div className="mb-2">
                                <span className="text-xs font-medium text-green-600">New Value:</span>
                                <pre className="text-xs mt-1 whitespace-pre-wrap">
                                  {formatValue(activity.new_value)}
                                </pre>
                              </div>
                            )}
                            
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Metadata:</span>
                                <pre className="text-xs mt-1 whitespace-pre-wrap">
                                  {JSON.stringify(activity.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {showDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleEntryExpansion(activity.id)}
                        className="ml-2"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Loading...' : 'Load More Activities'}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}