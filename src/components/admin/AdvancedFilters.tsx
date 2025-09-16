import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Filter,
  X,
  Calendar as CalendarIcon,
  Users,
  Search
} from "lucide-react";
import { format } from "date-fns";
import { UserRole } from "@/types/user";

export interface FilterCriteria {
  search?: string;
  roles?: UserRole[];
  membershipTiers?: string[];
  countries?: string[];
  emailVerified?: boolean | null;
  accountStatus?: 'enabled' | 'disabled' | null;
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  lastSignInAfter?: Date | null;
  lastSignInBefore?: Date | null;
  hasSubscription?: boolean | null;
  hasBio?: boolean | null;
  hasAvatar?: boolean | null;
}

interface AdvancedFiltersProps {
  filters: FilterCriteria;
  onFiltersChange: (filters: FilterCriteria) => void;
  availableCountries?: string[];
  userCount?: number;
  isLoading?: boolean;
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableCountries = [],
  userCount = 0,
  isLoading = false
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterCriteria>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof FilterCriteria, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleArrayFilterChange = (key: keyof FilterCriteria, value: string, checked: boolean) => {
    setLocalFilters(prev => {
      const currentArray = (prev[key] as string[]) || [];
      if (checked) {
        return {
          ...prev,
          [key]: [...currentArray, value]
        };
      } else {
        return {
          ...prev,
          [key]: currentArray.filter(item => item !== value)
        };
      }
    });
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const clearFilters = () => {
    const clearedFilters: FilterCriteria = {};
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.roles?.length) count++;
    if (filters.membershipTiers?.length) count++;
    if (filters.countries?.length) count++;
    if (filters.emailVerified !== null && filters.emailVerified !== undefined) count++;
    if (filters.accountStatus) count++;
    if (filters.createdAfter || filters.createdBefore) count++;
    if (filters.lastSignInAfter || filters.lastSignInBefore) count++;
    if (filters.hasSubscription !== null && filters.hasSubscription !== undefined) count++;
    if (filters.hasBio !== null && filters.hasBio !== undefined) count++;
    if (filters.hasAvatar !== null && filters.hasAvatar !== undefined) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 px-1 min-w-[20px] h-5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Advanced Filters</h3>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear All
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {userCount} users {isLoading && '(loading...)'}
            </p>
          </div>

          <div className="p-4 space-y-6 max-h-96 overflow-y-auto">
            {/* Role Filter */}
            <div>
              <Label className="text-sm font-medium">User Roles</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['user', 'prompter', 'jadmin', 'admin'] as UserRole[]).map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={localFilters.roles?.includes(role) || false}
                      onCheckedChange={(checked) => 
                        handleArrayFilterChange('roles', role, checked as boolean)
                      }
                    />
                    <Label htmlFor={`role-${role}`} className="text-sm capitalize">
                      {role}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Membership Tier Filter */}
            <div>
              <Label className="text-sm font-medium">Membership Tiers</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['free', 'basic', 'premium', 'enterprise'].map(tier => (
                  <div key={tier} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tier-${tier}`}
                      checked={localFilters.membershipTiers?.includes(tier) || false}
                      onCheckedChange={(checked) => 
                        handleArrayFilterChange('membershipTiers', tier, checked as boolean)
                      }
                    />
                    <Label htmlFor={`tier-${tier}`} className="text-sm capitalize">
                      {tier}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Account Status */}
            <div>
              <Label htmlFor="accountStatus" className="text-sm font-medium">Account Status</Label>
              <Select
                value={localFilters.accountStatus || ''}
                onValueChange={(value) => 
                  handleFilterChange('accountStatus', value === '' ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any status</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email Verification */}
            <div>
              <Label htmlFor="emailVerified" className="text-sm font-medium">Email Verification</Label>
              <Select
                value={localFilters.emailVerified === null ? '' : String(localFilters.emailVerified)}
                onValueChange={(value) => 
                  handleFilterChange('emailVerified', value === '' ? null : value === 'true')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any verification status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any verification status</SelectItem>
                  <SelectItem value="true">Verified</SelectItem>
                  <SelectItem value="false">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Profile Completeness */}
            <div>
              <Label className="text-sm font-medium">Profile Completeness</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasBio"
                    checked={localFilters.hasBio === true}
                    onCheckedChange={(checked) => 
                      handleFilterChange('hasBio', checked ? true : null)
                    }
                  />
                  <Label htmlFor="hasBio" className="text-sm">Has Bio</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasAvatar"
                    checked={localFilters.hasAvatar === true}
                    onCheckedChange={(checked) => 
                      handleFilterChange('hasAvatar', checked ? true : null)
                    }
                  />
                  <Label htmlFor="hasAvatar" className="text-sm">Has Avatar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasSubscription"
                    checked={localFilters.hasSubscription === true}
                    onCheckedChange={(checked) => 
                      handleFilterChange('hasSubscription', checked ? true : null)
                    }
                  />
                  <Label htmlFor="hasSubscription" className="text-sm">Has Subscription</Label>
                </div>
              </div>
            </div>

            {/* Date Ranges */}
            <div>
              <Label className="text-sm font-medium">Registration Date</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">After</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {localFilters.createdAfter 
                          ? format(localFilters.createdAfter, "MMM dd, yyyy")
                          : "Select date"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={localFilters.createdAfter || undefined}
                        onSelect={(date) => handleFilterChange('createdAfter', date)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Before</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {localFilters.createdBefore 
                          ? format(localFilters.createdBefore, "MMM dd, yyyy")
                          : "Select date"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={localFilters.createdBefore || undefined}
                        onSelect={(date) => handleFilterChange('createdBefore', date)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.roles?.map(role => (
            <Badge key={role} variant="secondary" className="text-xs">
              Role: {role}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => {
                  const newRoles = filters.roles?.filter(r => r !== role) || [];
                  onFiltersChange({ ...filters, roles: newRoles.length ? newRoles : undefined });
                }}
              />
            </Badge>
          ))}
          {filters.membershipTiers?.map(tier => (
            <Badge key={tier} variant="secondary" className="text-xs">
              Tier: {tier}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => {
                  const newTiers = filters.membershipTiers?.filter(t => t !== tier) || [];
                  onFiltersChange({ ...filters, membershipTiers: newTiers.length ? newTiers : undefined });
                }}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}