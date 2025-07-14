
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SignupFormValues } from "./validation";
import { UseFormReturn } from "react-hook-form";

interface SignupFormProps {
  form: UseFormReturn<SignupFormValues>;
  isLoading: boolean;
  isGoogleLoading: boolean;
  onSubmit: (values: SignupFormValues) => void;
  onFormError: (errors: any) => void;
}

export function SignupForm({ 
  form, 
  isLoading, 
  isGoogleLoading, 
  onSubmit, 
  onFormError 
}: SignupFormProps) {
  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit, onFormError)} 
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} className="mobile-input" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} className="mobile-input" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe123" {...field} className="mobile-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" {...field} className="mobile-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full mobile-button-primary" disabled={isLoading || isGoogleLoading}>
          {isLoading ? "Sending magic link..." : "Send Magic Link"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          We'll send you a secure link to sign in instantly without a password.
        </p>
      </form>
    </Form>
  );
}
