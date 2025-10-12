import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function PreviewDemo() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">Phase 3.3</Badge>
          <h2 className="text-3xl font-bold">Preview Components</h2>
        </div>
        <p className="text-muted-foreground">
          Preview and formatting components for prompts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview Features</CardTitle>
          <CardDescription>
            Preview components are demonstrated within the Wizard flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To see preview components in action:
            </p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Go to the <strong>Wizard</strong> or <strong>Management</strong> tab</li>
              <li>Start creating a prompt</li>
              <li>Navigate to Step 4 (Preview)</li>
              <li>See the formatted preview with all data</li>
            </ol>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Preview Component Features:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Formatted prompt text display</li>
                <li>Platform-specific formatting</li>
                <li>Copy to clipboard functionality</li>
                <li>Export options (Text, Markdown, JSON)</li>
                <li>Live preview sidebar</li>
                <li>Prompt summary cards</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
