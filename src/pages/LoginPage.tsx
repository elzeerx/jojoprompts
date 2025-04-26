
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
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
    <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] p-4 md:p-8">
      <Card className="mx-auto max-w-md w-full">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Account Access</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account or reset your password
          </CardDescription>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="forgot">Forgot Password</TabsTrigger>
            <TabsTrigger value="reset">Reset Password</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <CardContent>
              <LoginForm />
            </CardContent>
          </TabsContent>

          <TabsContent value="forgot">
            <CardContent>
              <ForgotPasswordForm />
            </CardContent>
          </TabsContent>

          <TabsContent value="reset">
            <CardContent>
              <ResetPasswordForm onSuccess={() => setActiveTab("login")} />
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
