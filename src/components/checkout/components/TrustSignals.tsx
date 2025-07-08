
import { Lock, Shield } from "lucide-react";

export function TrustSignals() {
  return (
    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-4">
      <div className="flex items-center gap-1">
        <Lock className="h-3 w-3" />
        <span>Secure</span>
      </div>
      <div className="flex items-center gap-1">
        <Shield className="h-3 w-3" />
        <span>Protected</span>
      </div>
    </div>
  );
}
