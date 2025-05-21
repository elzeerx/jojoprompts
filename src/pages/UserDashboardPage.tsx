import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CreditCard, User, History, ArrowUpRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, X } from 'lucide-react';

export default function UserDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchSubscriptionData();
      fetchUserProfile();
    }
  }, [user, authLoading, navigate]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      
      // Get active subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('*, plan_id(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (subscriptionError && subscriptionError.code !== 'PGRST116') { // Not found error
        throw subscriptionError;
      }
      
      if (subscriptionData) {
        setActiveSubscription(subscriptionData);
        setSubscriptionPlan(subscriptionData.plan_id);
      }

      // Get payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (paymentsError) throw paymentsError;
      
      setPaymentHistory(paymentsData || []);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      toast({
        title: "Error",
        description: "Failed to load subscription data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
      }
      
      setEmail(user.email);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setUpdateLoading(true);
      
      // Update profile in the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq('id', user.id);
      
      if (profileError) throw profileError;
      
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update profile information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdateLoading(false);
    }
  };
  
  const handleUpdateEmail = async () => {
    try {
      setUpdateLoading(true);
      
      // Update email through auth API
      const { error } = await supabase.auth.updateUser({ email });
      
      if (error) throw error;
      
      toast({
        title: "Verification Email Sent",
        description: "Check your email to confirm the update.",
      });
    } catch (error) {
      console.error('Error updating email:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdateLoading(false);
    }
  };
  
  const handleUpdatePassword = async () => {
    try {
      setUpdateLoading(true);
      
      if (password !== confirmPassword) {
        throw new Error("Passwords don't match");
      }
      
      // Update password through auth API
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully.",
      });
      
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-12 px-4">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Account Dashboard</h1>
      
      <Tabs defaultValue="subscription">
        <TabsList className="mb-8">
          <TabsTrigger value="subscription">My Subscription</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="profile">Account Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="subscription">
          <div className="space-y-8">
            {/* Current Subscription Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Current Plan</CardTitle>
                <CardDescription>
                  Your current subscription details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!activeSubscription ? (
                  <div className="text-center py-8">
                    <h3 className="text-lg font-medium mb-2">No active subscription</h3>
                    <p className="text-muted-foreground mb-6">
                      You don't have an active subscription yet.
                    </p>
                    <Button
                      onClick={() => navigate('/pricing')}
                      className="bg-warm-gold hover:bg-warm-gold/90"
                    >
                      View Plans
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center p-4 bg-warm-gold/5 rounded-lg border border-warm-gold/20">
                      <div>
                        <h3 className="text-xl font-medium text-warm-gold">
                          {subscriptionPlan?.name} Plan
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {subscriptionPlan?.is_lifetime 
                            ? 'Lifetime Access' 
                            : `Valid until ${new Date(activeSubscription.end_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold">
                          ${subscriptionPlan?.price_usd}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          One-time payment
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <div className="p-4 border rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          Purchased On
                        </h4>
                        <p>{new Date(activeSubscription.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          Payment Method
                        </h4>
                        <p className="capitalize">{activeSubscription.payment_method}</p>
                      </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t">
                      <h4 className="font-medium mb-4">Included Features:</h4>
                      <ul className="space-y-2">
                        {Array.isArray(subscriptionPlan?.features) && subscriptionPlan.features.map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <Check className="h-5 w-5 text-warm-gold mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="pt-6">
                      <Button 
                        variant="default" // Changed from "outline" to "default"
                        onClick={() => {
                          navigate('/pricing');
                        }}
                      >
                        Upgrade Plan <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Payment History</CardTitle>
              <CardDescription>
                Your record of payments and transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentHistory.length === 0 ? (
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium mb-2">No payment records found</h3>
                  <p className="text-muted-foreground">
                    You haven't made any payments yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground text-left">
                        <th className="p-3">Date</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Payment Method</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((payment) => (
                        <tr key={payment.id} className="border-b">
                          <td className="p-3">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            ${payment.amount_usd} ({payment.amount_kwd} KWD)
                          </td>
                          <td className="p-3 capitalize">{payment.payment_method}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              payment.status === 'completed' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="profile">
          <div className="space-y-8">
            {/* Profile Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Profile Information</CardTitle>
                <CardDescription>
                  Update your account information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profileLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-warm-gold text-white text-xl">
                          {firstName.charAt(0)}{lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-lg">{`${firstName} ${lastName}`}</p>
                        <p className="text-muted-foreground">{email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                      <h3 className="text-lg font-medium">Update Personal Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleUpdateProfile}
                        disabled={updateLoading}
                      >
                        {updateLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                        ) : (
                          'Update Profile'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Email Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Email Address</CardTitle>
                <CardDescription>
                  Update your email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  
                  <Alert variant="default" className="mb-6 bg-slate-50">
                    <AlertTitle>Verification Required</AlertTitle>
                    <AlertDescription>
                      You'll need to verify your new email address by clicking on the link sent to it.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleUpdateEmail}
                    disabled={updateLoading || email === user.email}
                  >
                    {updateLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                    ) : (
                      'Update Email'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Password Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Update your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleUpdatePassword}
                    disabled={updateLoading || !password || !confirmPassword || password !== confirmPassword}
                  >
                    {updateLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
