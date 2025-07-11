import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface LifetimeSubscriptionData {
  id: string;
  user_id: string;
  plan_id: string;
  end_date: string | null;
  profiles: {
    username: string;
    first_name: string;
    last_name: string;
  };
  subscription_plans: {
    name: string;
    is_lifetime: boolean;
  };
}

export function LifetimeSubscriptionValidator() {
  const [data, setData] = useState<LifetimeSubscriptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const validateLifetimeSubscriptions = async () => {
    setLoading(true);
    try {
      // First get all lifetime subscriptions
      const { data: lifetimePlans } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('is_lifetime', true);

      if (!lifetimePlans || lifetimePlans.length === 0) {
        toast({
          title: "No Lifetime Plans",
          description: "No lifetime plans found in the system",
        });
        return;
      }

      const lifetimePlanIds = lifetimePlans.map(p => p.id);

      const { data: subscriptions, error } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          user_id,
          plan_id,
          end_date,
          subscription_plans(name, is_lifetime)
        `)
        .eq('status', 'active')
        .in('plan_id', lifetimePlanIds);

      if (error) throw error;

      // Get user profiles separately
      const userIds = subscriptions?.map(s => s.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name')
        .in('id', userIds);

      // Combine the data
      const enrichedSubscriptions = subscriptions?.map(sub => ({
        ...sub,
        profiles: profiles?.find(p => p.id === sub.user_id) || {
          username: 'Unknown',
          first_name: 'Unknown',
          last_name: 'User'
        }
      })) || [];

      setData(enrichedSubscriptions);
      
      const incorrectCount = enrichedSubscriptions.filter(sub => sub.end_date !== null).length;
      const correctCount = enrichedSubscriptions.filter(sub => sub.end_date === null).length;

      toast({
        title: "Validation Complete",
        description: `Found ${enrichedSubscriptions.length} lifetime subscriptions. ${correctCount} correct, ${incorrectCount} need fixing.`,
      });

    } catch (error) {
      console.error('Error validating subscriptions:', error);
      toast({
        variant: "destructive",
        title: "Validation Failed",
        description: "Failed to validate lifetime subscriptions",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifetime Subscription Validator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={validateLifetimeSubscriptions}
          disabled={loading}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Validate Lifetime Subscriptions
        </Button>

        {data.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Lifetime Subscriptions Status:</h3>
            {data.map((subscription) => (
              <div 
                key={subscription.id} 
                className="flex items-center justify-between p-3 border rounded"
              >
                <div>
                  <p className="font-medium">
                    {subscription.profiles?.first_name} {subscription.profiles?.last_name} 
                    ({subscription.profiles?.username})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.subscription_plans?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {subscription.end_date === null ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Correct
                      </Badge>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      <Badge variant="destructive">
                        Has End Date
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}