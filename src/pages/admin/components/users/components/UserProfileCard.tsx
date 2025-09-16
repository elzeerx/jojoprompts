import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Send, 
  CreditCard,
  Mail,
  MapPin,
  Clock,
  User as UserIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExtendedUserProfile } from "@/types/user";

interface UserProfileCardProps {
  user: ExtendedUserProfile & { 
    subscription?: { 
      plan_name: string;
      status: string;
      is_lifetime: boolean;
      price_usd: number;
    } | null;
    is_email_confirmed?: boolean;
  };
  onEdit: () => void;
  onViewProfile: () => void;
  onAssignPlan: () => void;
  onSendResetEmail: () => void;
  onDeleteUser: () => void;
  onCancelSubscription?: () => void;
  isUpdating?: boolean;
}

export function UserProfileCard({
  user,
  onEdit,
  onViewProfile,
  onAssignPlan,
  onSendResetEmail,
  onDeleteUser,
  onCancelSubscription,
  isUpdating = false
}: UserProfileCardProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'jadmin': return 'secondary';
      case 'prompter': return 'outline';
      default: return 'secondary';
    }
  };

  const getSubscriptionBadgeVariant = (planName: string | undefined) => {
    if (!planName || planName === 'None') return 'secondary';
    switch (planName.toLowerCase()) {
      case 'premium': return 'default';
      case 'basic': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>
                {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">
                {user.first_name} {user.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isUpdating}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border z-50">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={onViewProfile}>
                <UserIcon className="mr-2 h-4 w-4" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAssignPlan}>
                <CreditCard className="mr-2 h-4 w-4" />
                Assign Plan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendResetEmail}>
                <Send className="mr-2 h-4 w-4" />
                Send Reset Email
              </DropdownMenuItem>
              {user.subscription && onCancelSubscription && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCancelSubscription}>
                    <CreditCard className="mr-2 h-4 w-4 text-orange-500" />
                    <span className="text-orange-500">Cancel Subscription</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDeleteUser}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                <span className="text-destructive">Delete User</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-3">
          {/* Email and Status */}
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{user.email}</span>
            <Badge variant={user.is_email_confirmed ? "default" : "destructive"} className="text-xs">
              {user.is_email_confirmed ? "Verified" : "Unverified"}
            </Badge>
          </div>

          {/* Role and Membership */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {user.role}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {user.membership_tier || 'free'}
              </Badge>
            </div>
            {user.subscription && (
              <Badge variant={getSubscriptionBadgeVariant(user.subscription.plan_name)}>
                {user.subscription.plan_name}
                {user.subscription.is_lifetime && " (Lifetime)"}
              </Badge>
            )}
          </div>

          {/* Location and Timezone */}
          {(user.country || user.timezone) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                {user.country && user.timezone 
                  ? `${user.country} (${user.timezone})`
                  : user.country || user.timezone
                }
              </span>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Joined {formatDate(user.created_at)}</span>
            </div>
            <span>Last seen {formatDate(user.last_sign_in_at)}</span>
          </div>

          {/* Bio (if exists) */}
          {user.bio && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {user.bio}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t">
          <Button onClick={onViewProfile} variant="outline" size="sm" className="flex-1">
            View Profile
          </Button>
          <Button onClick={onEdit} variant="default" size="sm" className="flex-1">
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}