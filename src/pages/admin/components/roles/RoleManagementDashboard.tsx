import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Award, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { USER_ROLES, ROLE_DESCRIPTIONS } from "@/contexts/roles";

interface RoleStats {
  role: string;
  count: number;
  percentage: number;
}

export function RoleManagementDashboard() {
  // Fetch role distribution
  const { data: roleStats, isLoading } = useQuery({
    queryKey: ['roleStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role');

      if (error) throw error;

      // Count users by role
      const roleCounts = data.reduce((acc, { role }) => {
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = data.length;

      // Convert to stats array
      const stats: RoleStats[] = Object.entries(roleCounts).map(([role, count]) => ({
        role,
        count,
        percentage: Math.round((count / total) * 100)
      }));

      return { stats, total };
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return <Crown className="h-5 w-5 text-red-500" />;
      case USER_ROLES.JADMIN:
        return <Shield className="h-5 w-5 text-orange-500" />;
      case USER_ROLES.PROMPTER:
        return <Award className="h-5 w-5 text-blue-500" />;
      default:
        return <Users className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      case USER_ROLES.JADMIN:
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case USER_ROLES.PROMPTER:
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return 'Administrators';
      case USER_ROLES.JADMIN:
        return 'Junior Admins';
      case USER_ROLES.PROMPTER:
        return 'Prompters';
      default:
        return 'Users';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Role Management</h2>
          <p className="text-muted-foreground">Overview of user roles and permissions</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Role Management</h2>
        <p className="text-muted-foreground">
          Overview of user roles and permissions across the platform
        </p>
      </div>

      {/* Role Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {roleStats?.stats.map((stat) => (
          <Card key={stat.role} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {getRoleDisplayName(stat.role)}
              </CardTitle>
              {getRoleIcon(stat.role)}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{stat.count}</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getRoleColor(stat.role)}>
                  {stat.percentage}%
                </Badge>
                <p className="text-xs text-muted-foreground">
                  of total users
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Users Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Total Platform Users</CardTitle>
          <CardDescription>
            Combined count of all users across all roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {roleStats?.total || 0}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            Overview of what each role can access and manage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
              <div key={role} className="flex items-start gap-4 p-4 rounded-lg border">
                <div className="mt-1">{getRoleIcon(role)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{getRoleDisplayName(role)}</h4>
                    <Badge variant="outline" className={getRoleColor(role)}>
                      {role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}