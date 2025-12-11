import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, Crown, Users, CheckCircle, XCircle, AlertTriangle, UserCheck, Ghost } from "lucide-react";

interface UsersFiltersProps {
  tierFilter: string;
  onTierFilterChange: (value: string) => void;
  verificationFilter: string;
  onVerificationFilterChange: (value: string) => void;
  accountStatusFilter: string;
  onAccountStatusFilterChange: (value: string) => void;
}

export function UsersFilters({
  tierFilter,
  onTierFilterChange,
  verificationFilter,
  onVerificationFilterChange,
  accountStatusFilter,
  onAccountStatusFilterChange,
}: UsersFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="font-medium">Filters:</span>
      </div>
      
      <Select value={tierFilter} onValueChange={onTierFilterChange}>
        <SelectTrigger className="w-[160px] h-9">
          <Crown className="h-3.5 w-3.5 mr-2 text-warm-gold" />
          <SelectValue placeholder="All Tiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tiers</SelectItem>
          <SelectItem value="free">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Free</Badge>
            </div>
          </SelectItem>
          <SelectItem value="basic">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-700 text-xs">Basic</Badge>
            </div>
          </SelectItem>
          <SelectItem value="standard">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 text-xs">Standard</Badge>
            </div>
          </SelectItem>
          <SelectItem value="premium">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-700 text-xs">Premium</Badge>
            </div>
          </SelectItem>
          <SelectItem value="ultimate">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-100 text-amber-700 text-xs">Ultimate</Badge>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={verificationFilter} onValueChange={onVerificationFilterChange}>
        <SelectTrigger className="w-[160px] h-9">
          <Users className="h-3.5 w-3.5 mr-2" />
          <SelectValue placeholder="All Users" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          <SelectItem value="verified">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              Verified
            </div>
          </SelectItem>
          <SelectItem value="unverified">
            <div className="flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
              Unverified
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={accountStatusFilter} onValueChange={onAccountStatusFilterChange}>
        <SelectTrigger className="w-[180px] h-9">
          <AlertTriangle className="h-3.5 w-3.5 mr-2 text-amber-500" />
          <SelectValue placeholder="Account Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accounts</SelectItem>
          <SelectItem value="active">
            <div className="flex items-center gap-2">
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              Active (Has Auth)
            </div>
          </SelectItem>
          <SelectItem value="orphaned">
            <div className="flex items-center gap-2">
              <Ghost className="h-3.5 w-3.5 text-amber-500" />
              Orphaned (No Auth)
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
