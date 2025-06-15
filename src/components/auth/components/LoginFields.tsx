
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function LoginFields({
  form,
  isLoading
}: {
  form: any;
  isLoading: boolean;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="email"
        render={({ field }: any) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="name@example.com"
                disabled={isLoading}
                autoComplete="email"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="password"
        render={({ field }: any) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input
                type="password"
                disabled={isLoading}
                autoComplete="current-password"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
