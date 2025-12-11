import React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, Crown, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: 'user' | 'prompter' | 'jadmin' | 'admin' | string;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

const roleConfig: Record<string, { 
  label: string; 
  icon: typeof Shield; 
  className: string;
}> = {
  admin: {
    label: 'Admin',
    icon: Crown,
    className: 'bg-warm-gold/10 text-warm-gold border-warm-gold/20 hover:bg-warm-gold/20',
  },
  jadmin: {
    label: 'Jr. Admin',
    icon: Shield,
    className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200',
  },
  prompter: {
    label: 'Prompter',
    icon: Users,
    className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
  },
  user: {
    label: 'User',
    icon: User,
    className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
  },
};

export function RoleBadge({ role, showIcon = true, size = 'default', className }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.user;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium capitalize transition-colors',
        config.className,
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1',
        className
      )}
    >
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {config.label}
    </Badge>
  );
}
