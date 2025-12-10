import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MailCheck, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('EMAIL_PREFERENCES');

export function EmailPreferences() {
  const { user } = useAuth();
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user?.email) {
      checkSubscriptionStatus();
    }
  }, [user?.email]);

  const checkSubscriptionStatus = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from('unsubscribed_emails')
        .select('email, unsubscribed_at, resubscribed_at')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;

      // User is unsubscribed if there's a record and no resubscribe date (or resubscribe date is before unsubscribe date)
      const isCurrentlyUnsubscribed = data && (!data.resubscribed_at || data.resubscribed_at < data.unsubscribed_at);
      setIsUnsubscribed(!!isCurrentlyUnsubscribed);
    } catch (error) {
      logger.error('Error checking subscription status', error);
      // Don't show error toast for this, just assume subscribed
      setIsUnsubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResubscribe = async () => {
    if (!user?.email) return;

    setIsUpdating(true);
    try {
      // Update the existing record with resubscribed_at timestamp
      const { error } = await supabase
        .from('unsubscribed_emails')
        .update({ 
          resubscribed_at: new Date().toISOString() 
        })
        .eq('email', user.email);

      if (error) throw error;

      setIsUnsubscribed(false);
      toast({
        title: "Resubscribed successfully",
        description: "You've been resubscribed to emails",
      });
    } catch (error: any) {
      logger.error('Error resubscribing', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resubscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getUnsubscribeUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/unsubscribe?email=${encodeURIComponent(user?.email || '')}&type=all`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading email preferences...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium">Email subscription status</p>
            <p className="text-sm text-muted-foreground">
              Manage your email communication preferences
            </p>
          </div>
          <Badge 
            variant={isUnsubscribed ? "destructive" : "default"}
            className="flex items-center gap-1"
          >
            {isUnsubscribed ? (
              <>
                <MailX className="h-3 w-3" />
                Unsubscribed
              </>
            ) : (
              <>
                <MailCheck className="h-3 w-3" />
                Subscribed
              </>
            )}
          </Badge>
        </div>

        {isUnsubscribed ? (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <p className="text-sm font-medium">You're currently unsubscribed from emails</p>
              <p className="text-sm text-muted-foreground">
                You won't receive any emails from us, including important account notifications.
              </p>
            </div>
            <Button 
              onClick={handleResubscribe}
              disabled={isUpdating}
              className="w-full sm:w-auto"
            >
              {isUpdating ? "Resubscribing..." : "Resubscribe to emails"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                You're receiving all emails
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                You'll receive updates, notifications, and important account information.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm">
                Manage email preferences
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open(getUnsubscribeUrl(), '_blank')}
              >
                Unsubscribe from emails
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            Email address: <span className="font-mono">{user?.email}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}