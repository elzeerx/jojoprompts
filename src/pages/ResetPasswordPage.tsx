
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a valid password reset request
    const token = searchParams.get('access_token') || searchParams.get('token');
    const type = searchParams.get('type');

    // If no valid reset token, redirect to login
    if (!token || type !== 'recovery') {
      navigate('/login?tab=forgot');
    }
  }, [searchParams, navigate]);

  const handleSuccess = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-[calc(100vh-9rem)] bg-gradient-to-br from-soft-bg via-white to-soft-bg overflow-hidden relative">
      {/* Enhanced mobile-optimized animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-16 -right-16 sm:-top-24 sm:-right-24 w-64 h-64 sm:w-96 sm:h-96 bg-warm-gold/5 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-16 -left-16 sm:-bottom-24 sm:-left-24 w-56 h-56 sm:w-80 sm:h-80 bg-muted-teal/5 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 sm:w-32 sm:h-32 bg-warm-gold/10 rounded-full animate-bounce delay-500"></div>
        <div className="absolute top-1/4 right-1/3 w-16 h-16 sm:w-24 sm:h-24 bg-muted-teal/10 rounded-full animate-pulse delay-700"></div>
      </div>

      <div className="flex items-center justify-center min-h-[calc(100vh-9rem)] mobile-container-padding mobile-section-padding relative z-10">
        <div className="mx-auto max-w-lg w-full">
          {/* Enhanced mobile-optimized card */}
          <Card className="border-2 border-warm-gold/20 rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl bg-white/95 backdrop-blur-sm overflow-hidden transform hover:scale-105 transition-all duration-300">
            {/* Mobile-optimized header */}
            <CardHeader className="space-y-2 sm:space-y-1 bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10 pb-6 sm:pb-8 pt-6 sm:pt-8 px-4 sm:px-6">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="relative">
                  <div className="rounded-full bg-gradient-to-r from-warm-gold to-muted-teal p-3 sm:p-4 text-white shadow-lg">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  {/* Floating sparkle */}
                  <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 text-warm-gold animate-bounce">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold text-center text-dark-base bg-clip-text">
                Reset Your Password
              </CardTitle>
              <CardDescription className="text-center text-base sm:text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed px-2 sm:px-0">
                Create a new password for your JoJo Prompts account
              </CardDescription>
            </CardHeader>

            <CardContent className="mobile-container-padding pt-6 sm:pt-8">
              <ResetPasswordForm onSuccess={handleSuccess} />
            </CardContent>

            {/* Premium footer with gradient */}
            <div className="h-2 bg-gradient-to-r from-warm-gold via-muted-teal to-warm-gold"></div>
          </Card>

          {/* Mobile-optimized floating elements */}
          <div className="absolute top-4 left-4 sm:top-8 sm:left-8 text-warm-gold/20 animate-pulse">
            <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
          <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 text-muted-teal/20 animate-pulse delay-1000">
            <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
