import { Button } from "@/components/ui/button";
import { 
  Plus, 
  UserPlus, 
  Percent, 
  Mail, 
  RefreshCw,
  FileText,
  Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface QuickActionsPanelProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function QuickActionsPanel({ onRefresh, isRefreshing }: QuickActionsPanelProps) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const actions = [
    {
      label: "Add Prompt",
      icon: Plus,
      onClick: () => navigate("/admin?tab=prompts&action=create"),
      primary: true,
    },
    {
      label: "Add User",
      icon: UserPlus,
      onClick: () => navigate("/admin?tab=users&action=create"),
      primary: true,
    },
    {
      label: "Create Discount",
      icon: Percent,
      onClick: () => navigate("/admin?tab=discounts&action=create"),
      primary: false,
    },
    {
      label: "Email Templates",
      icon: Mail,
      onClick: () => navigate("/admin?tab=emails"),
      primary: false,
    },
    {
      label: "Settings",
      icon: Settings,
      onClick: () => navigate("/admin?tab=settings"),
      primary: false,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
      <span className="text-sm font-medium text-muted-foreground mr-2">
        Quick Actions:
      </span>
      
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.primary ? "default" : "outline"}
          size="sm"
          onClick={action.onClick}
          className={cn(
            "gap-1.5 h-9",
            action.primary 
              ? "bg-warm-gold hover:bg-warm-gold/90 text-white" 
              : "hover:bg-gray-100 border-gray-200"
          )}
        >
          <action.icon className="h-4 w-4" />
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
      ))}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={refreshing || isRefreshing}
        className="gap-1.5 h-9 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={cn("h-4 w-4", (refreshing || isRefreshing) && "animate-spin")} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );
}
