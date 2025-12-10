import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, Shield } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardHeaderProps {
  pendingTransactions?: number;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export function DashboardHeader({ pendingTransactions = 0 }: DashboardHeaderProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>('Admin');
  
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('first_name, username')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setDisplayName(data.first_name || data.username || user.email?.split('@')[0] || 'Admin');
      } else {
        setDisplayName(user.email?.split('@')[0] || 'Admin');
      }
    };
    
    fetchProfile();
  }, [user?.id, user?.email]);

  const lastSignIn = user?.last_sign_in_at;
  const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('preview');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
      {/* Left: Greeting and subtitle */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-dark-base">
          {getGreeting()}, <span className="font-medium">{displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {lastSignIn ? (
            <>Last login: {format(new Date(lastSignIn), "MMM d, yyyy 'at' h:mm a")}</>
          ) : (
            <>Today is {format(new Date(), "EEEE, MMMM d, yyyy")}</>
          )}
        </p>
      </div>

      {/* Right: Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Environment indicator */}
        <Badge 
          variant="outline" 
          className={`gap-1.5 ${isProduction ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
        >
          <Shield className="h-3 w-3" />
          {isProduction ? 'Production' : 'Development'}
        </Badge>

        {/* Pending items indicator */}
        {pendingTransactions > 0 && (
          <Badge 
            variant="outline" 
            className="gap-1.5 border-rose-200 bg-rose-50 text-rose-700"
          >
            <Bell className="h-3 w-3" />
            {pendingTransactions} pending
          </Badge>
        )}

        {/* Admin role badge */}
        <Badge className="bg-warm-gold/10 text-warm-gold border-warm-gold/20 gap-1.5">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      </div>
    </div>
  );
}
