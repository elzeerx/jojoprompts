
import { Button } from "@/components/ui/button";

interface AuthModeToggleProps {
  isLogin: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function AuthModeToggle({ isLogin, onToggle, disabled }: AuthModeToggleProps) {
  return (
    <div className="text-center">
      <Button
        variant="link"
        className="p-0 text-sm"
        onClick={onToggle}
        disabled={disabled}
      >
        {isLogin
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"}
      </Button>
    </div>
  );
}
