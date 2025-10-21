import { useState } from 'react';
import { DynamicFieldGroup } from '@/components/prompts/fields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePlatformWithFields } from '@/hooks/usePlatforms';

export function DynamicRenderingDemo() {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

  const { data: platformWithFields, isLoading } = usePlatformWithFields(selectedPlatformId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">Phase 2.4</Badge>
          <h2 className="text-3xl font-bold">Dynamic Field Rendering</h2>
        </div>
        <p className="text-muted-foreground">
          Dynamically render platform-specific fields based on configuration
        </p>
      </div>

      {/* Platform Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select a Platform</CardTitle>
          <CardDescription>
            Choose a platform to see its custom fields rendered dynamically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a platform..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chatgpt">ChatGPT</SelectItem>
              <SelectItem value="midjourney">Midjourney</SelectItem>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="dalle">DALL-E</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Dynamic Fields */}
      {selectedPlatformId && (
        <Card>
          <CardHeader>
            <CardTitle>
              Platform Fields
            </CardTitle>
            <CardDescription>
              {platformWithFields?.fields.length || 0} custom fields for this platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading fields...
              </div>
            ) : platformWithFields?.fields.length ? (
              <DynamicFieldGroup
                fields={platformWithFields.fields}
                values={fieldValues}
                onChange={(key, value) => {
                  setFieldValues({ ...fieldValues, [key]: value });
                }}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No custom fields configured for this platform
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Values */}
      {selectedPlatformId && Object.keys(fieldValues).length > 0 && (
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle className="text-sm">Current Field Values</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(fieldValues, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">✨ Dynamic Rendering Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Database-driven field configuration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Multiple field types supported</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Automatic validation rules</span>
              </li>
            </ul>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Conditional field rendering</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Field ordering by display_order</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Type-safe value handling</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
