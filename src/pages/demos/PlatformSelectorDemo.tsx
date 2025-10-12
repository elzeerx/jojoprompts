import { useState } from 'react';
import { PlatformSelector, PlatformSelectorDialog, PlatformBadge } from '@/components/prompts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Grid3x3 } from 'lucide-react';
import type { Platform } from '@/types/platform';

export function PlatformSelectorDemo() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">Phase 2.5</Badge>
          <h2 className="text-3xl font-bold">Platform Selection</h2>
        </div>
        <p className="text-muted-foreground">
          Interactive platform selector with search and filtering
        </p>
      </div>

      {/* Demo Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inline Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Inline Selector</CardTitle>
            <CardDescription>
              Embedded platform selector component
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformSelector
              onSelect={(platform) => {
                setSelectedPlatform(platform);
              }}
            />
          </CardContent>
        </Card>

        {/* Dialog Version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Dialog Version</CardTitle>
            <CardDescription>
              Opens platform selector in a dialog
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlatformSelectorDialog
              trigger={
                <Button size="lg" className="w-full">
                  <Grid3x3 className="h-5 w-5 mr-2" />
                  Select Platform
                </Button>
              }
              onSelect={(platform) => {
                setSelectedPlatform(platform);
                setDialogOpen(false);
              }}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />

            {selectedPlatform && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Selected:</p>
                <PlatformBadge platform={selectedPlatform} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">✨ Platform Selector Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Real-time search filtering</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Grid and list view options</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Platform cards with icons</span>
              </li>
            </ul>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Category filtering</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Keyboard navigation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Mobile responsive design</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
