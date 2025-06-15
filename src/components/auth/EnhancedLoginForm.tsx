
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SecurityEnforcer } from "@/utils/enhancedSecurity";
import { InputValidator } from "@/utils/inputValidation";
import { useLoginForm, LoginFormValues } from "./hooks/useLoginForm";
import { useLoginSubmission } from "./hooks/useLoginSubmission";
import { RateLimitAlert } from "./components/RateLimitAlert";
import { LoginFields } from "./components/LoginFields";
import { LoginButton } from "./components/LoginButton";

interface EnhancedLoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
}

export function EnhancedLoginForm({ onSuccess, onSwitchToSignup }: EnhancedLoginFormProps) {
  const form = useLoginForm();
  const { isLoading, rateLimitError, onSubmit, setRateLimitError } = useLoginSubmission(onSuccess);

  // Make sure values are of type LoginFormValues, which has required fields
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          (values: LoginFormValues) => {
            // Defensive runtime check, though zod+react-hook-form should enforce types
            if (!values.email || !values.password) {
              toast({
                variant: "destructive",
                title: "Both email and password are required.",
              });
              return;
            }
            onSubmit(values, form.reset);
          }
        )}
        className="space-y-4"
      >
        {rateLimitError && <RateLimitAlert message={rateLimitError} />}

        <LoginFields form={form} isLoading={isLoading} />

        <LoginButton
          isLoading={isLoading}
          disabled={isLoading || !!rateLimitError}
        />

        {onSwitchToSignup && (
          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={onSwitchToSignup}
              disabled={isLoading}
            >
              Don't have an account? Sign up
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
