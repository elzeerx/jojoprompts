
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

export function LoginButton({
  isLoading,
  disabled
}: {
  isLoading: boolean;
  disabled: boolean;
}) {
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={disabled}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <Lock className="mr-2 h-4 w-4" />
          Sign In
        </>
      )}
    </Button>
  );
}
