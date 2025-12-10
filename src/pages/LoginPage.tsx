import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/LoginForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AppleEmailHelp } from "@/components/auth/AppleEmailHelp";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [searchParams] = useSearchParams();
  const { t, isRTL } = useTranslation();

  useEffect(() => {
    const token = searchParams.get('access_token') || searchParams.get('token');
    const type = searchParams.get('type');
    const tab = searchParams.get('tab');

    if (token && type === 'recovery') {
      setActiveTab("reset");
    } else if (tab) {
      if (['login', 'forgot', 'reset'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 sm:px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-md w-full">
          
          {/* Main Card with gap-px pattern */}
          <div className="grid gap-px bg-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-white">
              
              {/* Header */}
              <div className={cn(
                "p-6 sm:p-8 text-center",
                isRTL && "rtl-text"
              )}>
                <FileText className="h-8 w-8 text-warm-gold mx-auto mb-4" />
                <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-2">
                  {t('auth.welcomeBack')}
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground font-light max-w-sm mx-auto">
                  {t('auth.welcomeMessage')}
                </p>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 sm:px-8">
                  <div className="grid grid-cols-3 gap-px bg-gray-200 rounded-xl overflow-hidden">
                    <TabsList className="contents">
                      <TabsTrigger 
                        value="login" 
                        className={cn(
                          "bg-white py-3 text-xs sm:text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-gray-50/50 data-[state=active]:bg-warm-gold/5 data-[state=active]:text-warm-gold rounded-none",
                          isRTL && "rtl-text"
                        )}
                      >
                        {t('auth.login')}
                      </TabsTrigger>
                      <TabsTrigger 
                        value="forgot"
                        className={cn(
                          "bg-white py-3 text-xs sm:text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-gray-50/50 data-[state=active]:bg-warm-gold/5 data-[state=active]:text-warm-gold rounded-none",
                          isRTL && "rtl-text"
                        )}
                      >
                        {t('auth.forgot')}
                      </TabsTrigger>
                      <TabsTrigger 
                        value="reset"
                        className={cn(
                          "bg-white py-3 text-xs sm:text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-gray-50/50 data-[state=active]:bg-warm-gold/5 data-[state=active]:text-warm-gold rounded-none",
                          isRTL && "rtl-text"
                        )}
                      >
                        {t('auth.reset')}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <TabsContent value="login" className="mt-0">
                  <div className="p-6 sm:p-8 pt-6">
                    <LoginForm />
                  </div>
                </TabsContent>

                <TabsContent value="forgot" className="mt-0">
                  <div className="p-6 sm:p-8 pt-6">
                    <ForgotPasswordForm />
                  </div>
                </TabsContent>

                <TabsContent value="reset" className="mt-0">
                  <div className="p-6 sm:p-8 pt-6">
                    <ResetPasswordForm onSuccess={() => setActiveTab("login")} />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Apple Email Help */}
              <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                <AppleEmailHelp />
              </div>
              
            </div>
          </div>

          {/* Subtle accent line below card */}
          <div className="h-px bg-gray-200 mt-6 mx-8 group-hover:bg-warm-gold/30 transition-colors duration-300" />
          
        </div>
      </div>
    </div>
  );
}
