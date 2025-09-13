import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Search, 
  Filter, 
  Download, 
  Save,
  X,
  Calendar,
  Users,
  Activity,
  Star,
  CreditCard
} from 'lucide-react';
interface DateRange {
  from?: Date;
  to?: Date;
}

interface SearchFilters {
  text: string;
  role: string[];
  status: string[];
  membershipTier: string[];
  dateRange: DateRange | undefined;
  activityLevel: number[];
  promptCount: number[];
  hasSubscription: boolean | null;
  country: string[];
  tags: string[];
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  created_at: string;
}

export function AdvancedUserSearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    text: '',
    role: [],
    status: [],
    membershipTier: [],
    dateRange: undefined,
    activityLevel: [0],
    promptCount: [0],
    hasSubscription: null,
    country: [],
    tags: []
  });

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([
    {
      id: '1',
      name: 'Active Prompters',
      filters: {
        text: '',
        role: ['prompter'],
        status: ['active'],
        membershipTier: [],
        dateRange: undefined,
        activityLevel: [3],
        promptCount: [5],
        hasSubscription: true,
        country: [],
        tags: []
      },
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      name: 'Inactive Users (90 days)',
      filters: {
        text: '',
        role: ['user'],
        status: ['inactive'],
        membershipTier: [],
        dateRange: { 
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 
          to: new Date() 
        },
        activityLevel: [0],
        promptCount: [0],
        hasSubscription: false,
        country: [],
        tags: []
      },
      created_at: '2024-01-10T14:30:00Z'
    }
  ]);

  const [isSearching, setIsSearching] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  const availableRoles = ['user', 'prompter', 'jadmin', 'admin'];
  const availableStatuses = ['active', 'inactive', 'suspended', 'pending'];
  const availableMembershipTiers = ['free', 'premium', 'pro', 'lifetime'];
  const availableCountries = ['US', 'UK', 'CA', 'DE', 'FR', 'ES', 'IT', 'AU', 'JP', 'BR'];

  const handleSearch = async () => {
    setIsSearching(true);
    
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Searching with filters:', filters);
    
    setIsSearching(false);
  };

  const clearFilters = () => {
    setFilters({
      text: '',
      role: [],
      status: [],
      membershipTier: [],
      dateRange: undefined,
      activityLevel: [0],
      promptCount: [0],
      hasSubscription: null,
      country: [],
      tags: []
    });
  };

  const applyFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => {
      const currentArray = prev[key] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
  };

  const saveSearch = () => {
    if (!saveSearchName.trim()) return;
    
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName,
      filters: { ...filters },
      created_at: new Date().toISOString()
    };
    
    setSavedSearches(prev => [newSearch, ...prev]);
    setSaveSearchName('');
    setShowSaveDialog(false);
  };

  const loadSavedSearch = (search: SavedSearch) => {
    setFilters(search.filters);
  };

  const deleteSavedSearch = (searchId: string) => {
    setSavedSearches(prev => prev.filter(s => s.id !== searchId));
  };

  const exportResults = () => {
    // Mock export functionality
    console.log('Exporting search results with filters:', filters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.text) count++;
    if (filters.role.length > 0) count++;
    if (filters.status.length > 0) count++;
    if (filters.membershipTier.length > 0) count++;
    if (filters.dateRange) count++;
    if (filters.activityLevel[0] > 0) count++;
    if (filters.promptCount[0] > 0) count++;
    if (filters.hasSubscription !== null) count++;
    if (filters.country.length > 0) count++;
    if (filters.tags.length > 0) count++;
    return count;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced User Search</h2>
          <p className="text-muted-foreground">Find users with complex filters and conditions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportResults} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowSaveDialog(true)} variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save Search
          </Button>
        </div>
      </div>

      <Tabs defaultValue="filters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="filters">
            Search Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="saved">
            Saved Searches ({savedSearches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Text Search */}
              <div>
                <Label htmlFor="text-search">Text Search</Label>
                <Input
                  id="text-search"
                  placeholder="Search by name, email, username..."
                  value={filters.text}
                  onChange={(e) => applyFilter('text', e.target.value)}
                />
              </div>

              {/* Filter Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Role Filter */}
                <div>
                  <Label>User Role</Label>
                  <div className="space-y-2 mt-2">
                    {availableRoles.map(role => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={filters.role.includes(role)}
                          onCheckedChange={() => toggleArrayFilter('role', role)}
                        />
                        <Label htmlFor={`role-${role}`} className="capitalize">
                          {role}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <Label>Account Status</Label>
                  <div className="space-y-2 mt-2">
                    {availableStatuses.map(status => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={filters.status.includes(status)}
                          onCheckedChange={() => toggleArrayFilter('status', status)}
                        />
                        <Label htmlFor={`status-${status}`} className="capitalize">
                          {status}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Membership Tier */}
                <div>
                  <Label>Membership Tier</Label>
                  <div className="space-y-2 mt-2">
                    {availableMembershipTiers.map(tier => (
                      <div key={tier} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tier-${tier}`}
                          checked={filters.membershipTier.includes(tier)}
                          onCheckedChange={() => toggleArrayFilter('membershipTier', tier)}
                        />
                        <Label htmlFor={`tier-${tier}`} className="capitalize">
                          {tier}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <Label>Registration Date Range</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label>From</Label>
                    <Input
                      type="date"
                      value={filters.dateRange?.from?.toISOString().split('T')[0] || ''}
                      onChange={(e) => applyFilter('dateRange', {
                        ...filters.dateRange,
                        from: e.target.value ? new Date(e.target.value) : undefined
                      })}
                    />
                  </div>
                  <div>
                    <Label>To</Label>
                    <Input
                      type="date"
                      value={filters.dateRange?.to?.toISOString().split('T')[0] || ''}
                      onChange={(e) => applyFilter('dateRange', {
                        ...filters.dateRange,
                        to: e.target.value ? new Date(e.target.value) : undefined
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Activity Level */}
              <div>
                <Label>Activity Level (1-5)</Label>
                <div className="mt-2">
                  <Slider
                    value={filters.activityLevel}
                    onValueChange={(value) => applyFilter('activityLevel', value)}
                    max={5}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Inactive</span>
                    <span>Very Active</span>
                  </div>
                </div>
              </div>

              {/* Prompt Count */}
              <div>
                <Label>Minimum Prompts Created</Label>
                <div className="mt-2">
                  <Slider
                    value={filters.promptCount}
                    onValueChange={(value) => applyFilter('promptCount', value)}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Minimum: {filters.promptCount[0]} prompts
                  </div>
                </div>
              </div>

              {/* Subscription Status */}
              <div>
                <Label>Subscription Status</Label>
                <Select 
                  value={filters.hasSubscription === null ? 'any' : filters.hasSubscription.toString()}
                  onValueChange={(value) => 
                    applyFilter('hasSubscription', value === 'any' ? null : value === 'true')
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="true">Has Subscription</SelectItem>
                    <SelectItem value="false">No Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Country Filter */}
              <div>
                <Label>Country</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {availableCountries.map(country => (
                    <div key={country} className="flex items-center space-x-2">
                      <Checkbox
                        id={`country-${country}`}
                        checked={filters.country.includes(country)}
                        onCheckedChange={() => toggleArrayFilter('country', country)}
                      />
                      <Label htmlFor={`country-${country}`}>
                        {country}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleSearch} disabled={isSearching} className="flex-1">
              {isSearching ? (
                <>
                  <Search className="h-4 w-4 mr-2 animate-pulse" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search Users
                </>
              )}
            </Button>
            <Button onClick={clearFilters} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>

          {/* Active Filters Display */}
          {getActiveFilterCount() > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {filters.text && (
                    <Badge variant="secondary">
                      Text: "{filters.text}"
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => applyFilter('text', '')}
                      />
                    </Badge>
                  )}
                  {filters.role.map(role => (
                    <Badge key={role} variant="secondary">
                      Role: {role}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => toggleArrayFilter('role', role)}
                      />
                    </Badge>
                  ))}
                  {filters.status.map(status => (
                    <Badge key={status} variant="secondary">
                      Status: {status}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => toggleArrayFilter('status', status)}
                      />
                    </Badge>
                  ))}
                  {filters.hasSubscription !== null && (
                    <Badge variant="secondary">
                      Subscription: {filters.hasSubscription ? 'Yes' : 'No'}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => applyFilter('hasSubscription', null)}
                      />
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Searches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {savedSearches.map(search => (
                  <div key={search.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{search.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(search.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => loadSavedSearch(search)}
                        variant="outline"
                        size="sm"
                      >
                        Load
                      </Button>
                      <Button 
                        onClick={() => deleteSavedSearch(search.id)}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {savedSearches.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No saved searches yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Save Search</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search-name">Search Name</Label>
                <Input
                  id="search-name"
                  placeholder="Enter a name for this search..."
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSearch} disabled={!saveSearchName.trim()}>
                  Save
                </Button>
                <Button onClick={() => setShowSaveDialog(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}