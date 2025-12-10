import { useState } from 'react';
import { SimplifiedPromptDialog } from '@/components/prompts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function WizardDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">Simplified Prompt Creation</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Prompt Dialog Demo</h1>
        <p className="text-muted-foreground mt-2">
          Test the simplified prompt creation and editing dialog
        </p>
      </div>

      {/* Dialog Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Prompt
          </CardTitle>
          <CardDescription>
            Simplified prompt creation dialog with all essential fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            size="lg" 
            className="w-full"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Open Prompt Dialog
          </Button>
        </CardContent>
      </Card>

      <SimplifiedPromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          toast({
            title: "Success!",
            description: "Prompt created successfully",
          });
        }}
      />
    </div>
  );
}
