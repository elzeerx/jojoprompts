
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  plan: {
    id: string;
    name: string;
    price_usd: number;
    price_kwd: number;
    is_lifetime: boolean;
  };
}

interface Payment {
  id: string;
  created_at: string;
  amount_usd: number;
  amount_kwd: number;
  payment_method: string;
  status: string;
}

export default function SubscriptionDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/login?redirect=dashboard');
      return;
    }
    
    const fetchSubscriptionData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch the user's active subscription
        const { data: subData, error: subError } = await supabase
          .from('user_subscriptions')
          .select(`
            id,
            status,
            start_date,
            end_date,
            plan: plan_id (
              id,
              name,
              price_usd,
              price_kwd,
              is_lifetime
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (subError && subError.code !== 'PGRST116') {
          throw subError;
        }
        
        if (subData) {
          setActiveSubscription(subData as any);
        }
        
        // Fetch payment history
        const { data: paymentData, error: paymentError } = await supabase
          .from('payment_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (paymentError) throw paymentError;
        
        setPayments(paymentData || []);
      } catch (err: any) {
        console.error('Error fetching subscription data:', err);
        setError(err.message || 'Failed to load subscription data');
        toast({
          title: "Error",
          description: "Failed to load your subscription data. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscriptionData();
  }, [user, navigate, authLoading]);
  
  const generateInvoice = (payment: Payment) => {
    // This is a placeholder - in a real application, you'd generate 
    // and download an actual invoice PDF
    toast({
      title: "Invoice Downloaded",
      description: `Invoice #${payment.id.slice(0, 8)} has been downloaded.`,
    });
  };
  
  const getSubscriptionStatus = () => {
    if (!activeSubscription) return "No Active Subscription";
    
    if (activeSubscription.plan.is_lifetime) {
      return "Lifetime Access";
    }
    
    if (!activeSubscription.end_date) {
      return "Active";
    }
    
    const endDate = new Date(activeSubscription.end_date);
    const now = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 0) {
      return "Expired";
    }
    
    if (daysRemaining <= 10) {
      return `Expires Soon (${daysRemaining} days left)`;
    }
    
    return `Active (${daysRemaining} days left)`;
  };
  
  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const subscriptionStatus = getSubscriptionStatus();
  const isExpired = subscriptionStatus === "Expired";
  const isExpiringSoon = subscriptionStatus.includes("Expires Soon");
  const hasSubscription = activeSubscription !== null;
  
  return (
    <div className="container max-w-4xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">My Subscription</h1>
      
      <Tabs defaultValue="subscription">
        <TabsList className="mb-6">
          <TabsTrigger value="subscription">Subscription Details</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>Manage your current subscription and access</CardDescription>
            </CardHeader>
            
            <CardContent>
              {!hasSubscription ? (
                <div className="text-center py-6">
                  <p className="text-lg mb-4">You don't have an active subscription yet.</p>
                  <Button asChild>
                    <Link to="/checkout">Choose a Plan</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">Current Plan</span>
                    <span className="font-bold text-lg">{activeSubscription.plan.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Status</span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      isExpired ? 'bg-red-100 text-red-800' :
                      isExpiringSoon ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {subscriptionStatus}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Start Date</span>
                    <span>{format(new Date(activeSubscription.start_date), 'PPP')}</span>
                  </div>
                  
                  {!activeSubscription.plan.is_lifetime && activeSubscription.end_date && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">End Date</span>
                      <span>{format(new Date(activeSubscription.end_date), 'PPP')}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Price Paid</span>
                    <span>${activeSubscription.plan.price_usd} (or {activeSubscription.plan.price_kwd} KWD)</span>
                  </div>
                  
                  {isExpiringSoon && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-yellow-400" />
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            Your subscription will expire soon. Consider upgrading to continue accessing all features.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {isExpired && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <div className="ml-3">
                          <p className="text-sm text-red-700">
                            Your subscription has expired. Renew now to regain access to all features.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            
            <CardFooter>
              {hasSubscription && (isExpired || !activeSubscription.plan.is_lifetime) && (
                <Button className="w-full" asChild>
                  <Link to="/checkout">
                    {isExpired ? 'Renew Subscription' : 'Upgrade Plan'}
                  </Link>
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View your past payments and download invoices</CardDescription>
            </CardHeader>
            
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No payment records found.
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment, index) => (
                    <div key={payment.id}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            Payment #{payment.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.created_at), 'PPP')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            ${payment.amount_usd} / {payment.amount_kwd} KWD
                          </p>
                          <p className="text-sm capitalize text-muted-foreground">
                            {payment.payment_method}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => generateInvoice(payment)}>
                          <Download className="h-5 w-5" />
                        </Button>
                      </div>
                      
                      {index < payments.length - 1 && <Separator className="my-4" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
