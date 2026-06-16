import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Sparkles } from "lucide-react";
import type { AiAssetPayload } from "./types";

interface Props {
  asset: AiAssetPayload | null;
}

export function AssetPreviewPane({ asset }: Props) {
  const jsonText = useMemo(() => {
    if (!asset) return "";
    if (asset.json !== undefined && asset.json !== null) {
      try {
        return JSON.stringify(asset.json, null, 2);
      } catch {
        return String(asset.json);
      }
    }
    return JSON.stringify(asset, null, 2);
  }, [asset]);

  const bodyText = asset?.body || "";
  const copyValue = bodyText || jsonText;

  if (!asset) {
    return (
      <Card className="h-full flex items-center justify-center border-dashed">
        <CardContent className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            Your generated asset will appear here.
          </p>
          <p className="text-xs mt-1">
            Ask the assistant for a prompt, JSON spec, skill, or workflow.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">
              {asset.title || "Untitled"}
            </CardTitle>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="secondary">{asset.kind}</Badge>
              {asset.target_llm && (
                <Badge variant="outline">{asset.target_llm}</Badge>
              )}
              {asset.language && (
                <Badge variant="outline">{asset.language}</Badge>
              )}
              {asset.tags?.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          {copyValue && (
            <CopyButton
              value={copyValue}
              successDescription="Asset copied to clipboard"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue={bodyText ? "rendered" : "json"} className="h-full flex flex-col">
          <TabsList className="mx-4">
            <TabsTrigger value="rendered" disabled={!bodyText}>
              Rendered
            </TabsTrigger>
            <TabsTrigger value="raw" disabled={!bodyText}>
              Raw text
            </TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="rendered" className="flex-1 overflow-auto px-4 pb-4 mt-2">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{bodyText}</ReactMarkdown>
            </div>
          </TabsContent>
          <TabsContent value="raw" className="flex-1 overflow-auto px-4 pb-4 mt-2">
            <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-3 rounded-md">
              {bodyText}
            </pre>
          </TabsContent>
          <TabsContent value="json" className="flex-1 overflow-auto px-4 pb-4 mt-2">
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
              {jsonText}
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
