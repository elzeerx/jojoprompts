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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          onSubmit // No need for extra checks, type safety is handled with zod
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
