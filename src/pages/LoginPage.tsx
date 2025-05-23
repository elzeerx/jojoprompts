
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/LoginForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for password reset token or tab parameter
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const tab = searchParams.get('tab');

    if (token && type === 'recovery') {
      setActiveTab("reset");
    } else if (tab) {
      // Allow external navigation to specific tabs
      if (['login', 'forgot', 'reset'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-[calc(100vh-9rem)] bg-gradient-to-br from-soft-bg via-white to-soft-bg overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-warm-gold/5 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-muted-teal/5 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-warm-gold/10 rounded-full animate-bounce delay-500"></div>
        <div className="absolute top-1/4 right-1/3 w-24 h-24 bg-muted-teal/10 rounded-full animate-pulse delay-700"></div>
      </div>

      <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] p-4 md:p-8 relative z-10">
        <div className="mx-auto max-w-lg w-full">
          {/* Enhanced Card with gradient border and shadow */}
          <Card className="border-2 border-warm-gold/20 rounded-3xl shadow-2xl bg-white/95 backdrop-blur-sm overflow-hidden transform hover:scale-105 transition-all duration-300">
            {/* Header with gradient background */}
            <CardHeader className="space-y-1 bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10 pb-8 pt-8">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="rounded-full bg-gradient-to-r from-warm-gold to-muted-teal p-4 text-white shadow-lg">
                    <FileText className="h-8 w-8" />
                  </div>
                  {/* Floating sparkle */}
                  <div className="absolute -top-2 -right-2 text-warm-gold animate-bounce">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-center text-dark-base bg-clip-text">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-center text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Access your premium AI prompts and continue your creative journey
              </CardDescription>
            </CardHeader>

            {/* Enhanced Tabs with premium styling */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="px-6">
                <TabsList className="grid grid-cols-3 w-full bg-soft-bg/50 p-1 rounded-xl">
                  <TabsTrigger 
                    value="login" 
                    className="rounded-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-warm-gold"
                  >
                    Login
                  </TabsTrigger>
                  <TabsTrigger 
                    value="forgot"
                    className="rounded-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-warm-gold"
                  >
                    Forgot Password
                  </TabsTrigger>
                  <TabsTrigger 
                    value="reset"
                    className="rounded-lg font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-warm-gold"
                  >
                    Reset Password
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="login" className="mt-0">
                <CardContent className="p-6 pt-8">
                  <LoginForm />
                </CardContent>
              </TabsContent>

              <TabsContent value="forgot" className="mt-0">
                <CardContent className="p-6 pt-8">
                  <ForgotPasswordForm />
                </CardContent>
              </TabsContent>

              <TabsContent value="reset" className="mt-0">
                <CardContent className="p-6 pt-8">
                  <ResetPasswordForm onSuccess={() => setActiveTab("login")} />
                </CardContent>
              </TabsContent>
            </Tabs>

            {/* Premium footer with gradient */}
            <div className="h-2 bg-gradient-to-r from-warm-gold via-muted-teal to-warm-gold"></div>
          </Card>

          {/* Floating elements for extra visual appeal */}
          <div className="absolute top-8 left-8 text-warm-gold/20 animate-pulse">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="absolute bottom-8 right-8 text-muted-teal/20 animate-pulse delay-1000">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
