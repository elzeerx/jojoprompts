import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  UserPlus, 
  Download, 
  Mail, 
  RefreshCw,
  Settings,
  Ticket,
  FileText
} from "lucide-react";

interface QuickActionsPanelProps {
  onCreateUser: () => void;
  onExportAll: () => void;
  onRefresh: () => void;
  onOpenDiscounts?: () => void;
  onOpenEmailTemplates?: () => void;
  isLoading?: boolean;
}

export function QuickActionsPanel({
  onCreateUser,
  onExportAll,
  onRefresh,
  onOpenDiscounts,
  onOpenEmailTemplates,
  isLoading = false,
}: QuickActionsPanelProps) {
  const actions = [
    {
      icon: UserPlus,
      label: "Add User",
      onClick: onCreateUser,
      color: "text-green-600 hover:bg-green-50",
    },
    {
      icon: Download,
      label: "Export All",
      onClick: onExportAll,
      color: "text-blue-600 hover:bg-blue-50",
    },
    {
      icon: Ticket,
      label: "Discounts",
      onClick: onOpenDiscounts,
      color: "text-purple-600 hover:bg-purple-50",
      hidden: !onOpenDiscounts,
    },
    {
      icon: FileText,
      label: "Email Templates",
      onClick: onOpenEmailTemplates,
      color: "text-cyan-600 hover:bg-cyan-50",
      hidden: !onOpenEmailTemplates,
    },
    {
      icon: RefreshCw,
      label: "Refresh",
      onClick: onRefresh,
      color: "text-gray-600 hover:bg-gray-50",
      loading: isLoading,
    },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
        {actions.filter(a => !a.hidden).map((action, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={action.onClick}
                disabled={action.loading}
                className={`h-9 w-9 p-0 ${action.color}`}
              >
                <action.icon className={`h-4 w-4 ${action.loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{action.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
