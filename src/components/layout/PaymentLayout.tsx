
import { Outlet } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function PaymentLayout() {
  return (
    <div className="min-h-screen bg-soft-bg relative">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 text-warm-gold/20 animate-pulse">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="absolute bottom-10 left-10 text-muted-teal/20 animate-pulse delay-1000">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>
      
      {/* Main content */}
      <div className="relative z-10">
        <Outlet />
      </div>
    </div>
  );
}
