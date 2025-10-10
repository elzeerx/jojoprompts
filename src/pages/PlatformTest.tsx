/**
 * PlatformTest.tsx
 * 
 * Demo/Test page to verify the platform system works correctly.
 * This page displays all platforms with their fields and allows testing
 * of platform selection and field rendering.
 * 
 * FOR TESTING ONLY - NOT FOR PRODUCTION USE
 */

import { useState } from 'react';
import { Container } from '@/components/ui/container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePlatforms, usePlatformWithFields } from '@/hooks/usePlatforms';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export default function PlatformTest() {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  
  // Fetch all platforms
  const { data: platforms, isLoading: platformsLoading, error: platformsError } = usePlatforms();
  
  // Fetch selected platform with fields
  const { data: platformWithFields, isLoading: fieldsLoading, error: fieldsError } = usePlatformWithFields(
    selectedPlatformId
  );

  // Helper to get icon component
  const getIconComponent = (iconName: string): LucideIcon => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.Sparkles;
  };

  return (
    <Container className="py-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Platform System Test</h1>
          <p className="text-muted-foreground text-lg">
            Verify that all platforms and fields are configured correctly
          </p>
          <Alert>
            <AlertDescription>
              🧪 This is a test page for developers. Not intended for production use.
            </AlertDescription>
          </Alert>
        </div>

        {/* Platform Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Available Platforms</CardTitle>
            <CardDescription>
              All active platforms loaded from the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platformsLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {platformsError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Error loading platforms: {platformsError.message}
                </AlertDescription>
              </Alert>
            )}

            {platforms && platforms.length === 0 && (
              <Alert>
                <AlertDescription>
                  No platforms found. Please run the seed data migration.
                </AlertDescription>
              </Alert>
            )}

            {platforms && platforms.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {platforms.map((platform) => {
                  const Icon = getIconComponent(platform.icon);
                  return (
                    <Card key={platform.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{platform.name}</CardTitle>
                            <CardDescription className="mt-1">
                              {platform.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary">{platform.category}</Badge>
                          <Badge variant="outline">Order: {platform.display_order}</Badge>
                          {platform.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Test Platform Fields</CardTitle>
            <CardDescription>
              Select a platform to view its configured fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Platform</label>
              <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a platform..." />
                </SelectTrigger>
                <SelectContent>
                  {platforms?.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Platform Details */}
            {selectedPlatformId && (
              <>
                {fieldsLoading && (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                )}

                {fieldsError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Error loading fields: {fieldsError.message}
                    </AlertDescription>
                  </Alert>
                )}

                {platformWithFields && (
                  <div className="space-y-6 border-t pt-6">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = getIconComponent(platformWithFields.icon);
                        return <Icon className="h-8 w-8 text-primary" />;
                      })()}
                      <div>
                        <h3 className="text-xl font-semibold">{platformWithFields.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {platformWithFields.fields.length} configured fields
                        </p>
                      </div>
                    </div>

                    {platformWithFields.fields.length === 0 ? (
                      <Alert>
                        <AlertDescription>
                          No fields configured for this platform.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="font-medium">Platform Fields:</h4>
                        <div className="grid gap-4">
                          {platformWithFields.fields.map((field) => (
                            <Card key={field.id}>
                              <CardContent className="pt-6">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h5 className="font-medium">
                                        {field.label}
                                        {field.is_required && (
                                          <span className="text-destructive ml-1">*</span>
                                        )}
                                      </h5>
                                      <p className="text-sm text-muted-foreground">
                                        Key: <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                          {field.field_key}
                                        </code>
                                      </p>
                                    </div>
                                    <Badge>{field.field_type}</Badge>
                                  </div>

                                  {field.help_text && (
                                    <p className="text-sm text-muted-foreground">
                                      ℹ️ {field.help_text}
                                    </p>
                                  )}

                                  {field.placeholder && (
                                    <p className="text-xs text-muted-foreground">
                                      Placeholder: "{field.placeholder}"
                                    </p>
                                  )}

                                  {field.default_value && (
                                    <p className="text-xs">
                                      Default: <code className="bg-muted px-1 py-0.5 rounded">
                                        {field.default_value}
                                      </code>
                                    </p>
                                  )}

                                  {field.options && field.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      <span className="text-xs text-muted-foreground mr-2">Options:</span>
                                      {field.options.map((option, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {option.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  {field.validation_rules && Object.keys(field.validation_rules).length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      Validation: <code className="bg-muted px-1 py-0.5 rounded">
                                        {JSON.stringify(field.validation_rules)}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Testing Summary */}
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${platforms && platforms.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">
                  Platforms Loaded: {platforms?.length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${platformWithFields && platformWithFields.fields.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm">
                  Fields Loaded: {platformWithFields?.fields.length || 0} 
                  {selectedPlatformId ? ` (${platformWithFields?.name || 'Loading...'})` : ' (Select a platform)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${!platformsError && !fieldsError ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">
                  No Errors: {!platformsError && !fieldsError ? 'Pass ✓' : 'Fail ✗'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
