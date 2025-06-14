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
import { Container } from "@/components/ui/container";
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';

interface Transaction {
  id: string;
  created_at: string;
  amount_usd: number;
  status: string;
}

export default function UserDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

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

      // Get transaction history
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('id, created_at, amount_usd, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (transactionError) throw transactionError;
      
      setTransactions(transactionData || []);
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
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-6 sm:py-12">
        {/* Mobile-optimized header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Account Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your account and subscription</p>
        </div>
        
        <Tabs defaultValue="subscription" className="space-y-6">
          {/* Mobile-optimized tab navigation */}
          <div className="mobile-container-padding">
            <TabsList className={`
              mobile-tabs w-full justify-start bg-white/80 backdrop-blur-sm border border-gray-200 h-auto
              ${isMobile ? 'grid grid-cols-3 gap-1' : 'flex'}
            `}>
              <TabsTrigger 
                value="subscription" 
                className="mobile-tab data-[state=active]:mobile-tab-active data-[state=inactive]:mobile-tab-inactive text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-1 sm:gap-2"
              >
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
                {isSmallMobile ? "Plan" : "My Subscription"}
              </TabsTrigger>
              <TabsTrigger 
                value="payments" 
                className="mobile-tab data-[state=active]:mobile-tab-active data-[state=inactive]:mobile-tab-inactive text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-1 sm:gap-2"
              >
                <History className="h-3 w-3 sm:h-4 sm:w-4" />
                {isSmallMobile ? "History" : "Payment History"}
              </TabsTrigger>
              <TabsTrigger 
                value="profile" 
                className="mobile-tab data-[state=active]:mobile-tab-active data-[state=inactive]:mobile-tab-inactive text-xs sm:text-sm px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-1 sm:gap-2"
              >
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
                {isSmallMobile ? "Settings" : "Account Settings"}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="subscription" className="space-y-6">
            {/* Current Subscription Card - Mobile Optimized */}
            <Card className="mobile-optimize-rendering">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl">Current Plan</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Your current subscription details
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {!activeSubscription ? (
                  <div className="text-center py-6 sm:py-8">
                    <h3 className="text-lg font-medium mb-2">No active subscription</h3>
                    <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">
                      You don't have an active subscription yet.
                    </p>
                    <Button
                      onClick={() => navigate('/pricing')}
                      className="bg-warm-gold hover:bg-warm-gold/90 w-full sm:w-auto"
                      size={isMobile ? "default" : "lg"}
                    >
                      View Plans
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Mobile-optimized subscription info */}
                    <div className="p-4 sm:p-6 bg-warm-gold/5 rounded-xl border border-warm-gold/20">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                        <div className="text-center sm:text-left">
                          <h3 className="text-lg sm:text-xl font-medium text-warm-gold">
                            {subscriptionPlan?.name} Plan
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {subscriptionPlan?.is_lifetime 
                              ? 'Lifetime Access' 
                              : `Valid until ${new Date(activeSubscription.end_date).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-xl sm:text-2xl font-semibold">
                            ${subscriptionPlan?.price_usd}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            One-time payment
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Mobile-optimized grid layout */}
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="p-3 sm:p-4 border rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">
                          Purchased On
                        </h4>
                        <p className="text-sm sm:text-base">{new Date(activeSubscription.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="p-3 sm:p-4 border rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">
                          Payment Method
                        </h4>
                        <p className="text-sm sm:text-base capitalize">{activeSubscription.payment_method}</p>
                      </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t">
                      <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Included Features:</h4>
                      <ul className="space-y-2">
                        {Array.isArray(subscriptionPlan?.features) && subscriptionPlan.features.map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-warm-gold mr-2 flex-shrink-0 mt-0.5" />
                            <span className="text-sm sm:text-base">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="pt-4 sm:pt-6">
                      <Button 
                        variant="default"
                        onClick={() => navigate('/pricing')}
                        className="w-full sm:w-auto"
                        size={isMobile ? "default" : "lg"}
                      >
                        Upgrade Plan <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="payments" className="space-y-6">
            <Card className="mobile-optimize-rendering">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl">Payment History</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Your record of payments and transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {transactions.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <h3 className="text-lg font-medium mb-2">No payment records found</h3>
                    <p className="text-muted-foreground text-sm sm:text-base">
                      You haven't made any payments yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Mobile-optimized payment cards */}
                    {isMobile ? (
                      <div className="space-y-3">
                        {transactions.map((transaction) => (
                          <div key={transaction.id} className="p-4 border rounded-lg bg-white/50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-sm">
                                  ${transaction.amount_usd}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(transaction.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                transaction.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {transaction.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Desktop table layout
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-muted text-muted-foreground text-left">
                              <th className="p-3">Date</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((transaction) => (
                              <tr key={transaction.id} className="border-b">
                                <td className="p-3">
                                  {new Date(transaction.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-3">
                                  ${transaction.amount_usd}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    transaction.status === 'completed' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {transaction.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="profile" className="space-y-6">
            {/* Profile Information Card - Mobile Optimized */}
            <Card className="mobile-optimize-rendering">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl">Profile Information</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Update your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {profileLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Mobile-optimized profile header */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                      <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
                        <AvatarFallback className="bg-warm-gold text-white text-lg sm:text-xl">
                          {firstName.charAt(0)}{lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center sm:text-left">
                        <p className="font-medium text-base sm:text-lg">{`${firstName} ${lastName}`}</p>
                        <p className="text-muted-foreground text-sm sm:text-base">{email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                      <h3 className="text-base sm:text-lg font-medium">Update Personal Information</h3>
                      
                      {/* Mobile-optimized form fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-sm">First Name</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="mobile-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="mobile-input"
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleUpdateProfile}
                        disabled={updateLoading}
                        className="w-full sm:w-auto"
                        size={isMobile ? "default" : "lg"}
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
            
            {/* Email Settings Card - Mobile Optimized */}
            <Card className="mobile-optimize-rendering">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Email Address</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Update your email address
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  
                  <Alert variant="default" className="mb-4">
                    <AlertTitle className="text-sm">Verification Required</AlertTitle>
                    <AlertDescription className="text-xs sm:text-sm">
                      You'll need to verify your new email address by clicking on the link sent to it.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleUpdateEmail}
                    disabled={updateLoading || email === user.email}
                    className="w-full sm:w-auto"
                    size={isMobile ? "default" : "lg"}
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
            
            {/* Password Settings Card - Mobile Optimized */}
            <Card className="mobile-optimize-rendering">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Password</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Update your password
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleUpdatePassword}
                    disabled={updateLoading || !password || !confirmPassword || password !== confirmPassword}
                    className="w-full sm:w-auto"
                    size={isMobile ? "default" : "lg"}
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
          </TabsContent>
        </Tabs>
      </Container>
    </div>
  );
}
