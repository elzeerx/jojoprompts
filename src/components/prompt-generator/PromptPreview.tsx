import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PromptPreviewProps {
  prompt: string;
  data: any;
  mode: "text" | "json";
}

export function PromptPreview({ prompt, data, mode }: PromptPreviewProps) {
  if (mode === "json") {
    return (
      <div className="space-y-4">
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          <pre className="text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[300px] w-full rounded-md border p-4">
        <div className="text-sm whitespace-pre-wrap">
          {prompt}
        </div>
      </ScrollArea>
      
      {data && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Prompt Details:</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              Model: {data.model}
            </Badge>
            <Badge variant="outline">
              Type: {data.modelType}
            </Badge>
            {data.parameters && Object.keys(data.parameters).length > 0 && (
              <Badge variant="outline">
                Parameters: {Object.keys(data.parameters).length}
              </Badge>
            )}
          </div>
          
          {data.parameters && Object.keys(data.parameters).length > 0 && (
            <div className="mt-2">
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Parameters:</h5>
              <div className="flex flex-wrap gap-1">
                {Object.entries(data.parameters).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}