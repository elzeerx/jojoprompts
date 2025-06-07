
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { Calendar, Crown, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export function SubscriptionDashboard() {
  const { isActive, planName, expiresAt, isLifetime, loading, error, refresh } = useSubscriptionStatus();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Error loading subscription</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gray-400" />
            No Active Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            You don't have an active subscription. Upgrade to access premium features.
          </p>
          <div className="space-y-2">
            <Button asChild>
              <Link to="/pricing">View Plans</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/payment-history">Payment History</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isExpiringSoon = expiresAt && !isLifetime && 
    new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

  return (
    <Card className={isActive ? 'border-green-200' : 'border-gray-200'}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span>{planName}</span>
          </div>
          <Badge className="bg-green-100 text-green-800">
            Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-500" />
          {isLifetime ? (
            <span className="text-green-600 font-medium">Lifetime Access</span>
          ) : expiresAt ? (
            <span className={isExpiringSoon ? 'text-orange-600' : 'text-gray-600'}>
              Expires {formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}
            </span>
          ) : (
            <span className="text-gray-600">Active subscription</span>
          )}
        </div>

        {isExpiringSoon && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Subscription Expiring Soon</span>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              Your subscription will expire soon. Renew to continue accessing premium features.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/pricing">Upgrade Plan</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/payment-history">Payment History</Link>
          </Button>
          <Button onClick={refresh} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
