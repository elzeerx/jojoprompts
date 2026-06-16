import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  FileJson,
  Save,
  Upload,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CopyButton } from "@/components/ui/copy-button";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatJsonPrompt,
  parseJsonPrompts,
  prettyJson,
  SAMPLE_JSON_PROMPT,
  type PromptTarget,
} from "@/lib/formatters/jsonPromptFormatter";
import { PromptService } from "@/services/PromptService";
import { createLogger } from "@/utils/logging";

const logger = createLogger("JSON_PROMPT_IMPORTER");

const TARGETS: { value: PromptTarget; label: string }[] = [
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
  { value: "midjourney", label: "Midjourney" },
  { value: "gemini", label: "Gemini" },
  { value: "generic", label: "Generic" },
];

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function JsonPromptImporter() {
  const { user } = useAuth();
  const [raw, setRaw] = useState<string>("");
  const [target, setTarget] = useState<PromptTarget>("chatgpt");
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseJsonPrompts(raw), [raw]);

  const formattedPreviews = useMemo(() => {
    if (!parsed.ok) return [];
    return parsed.prompts.map((p) => ({
      title: p.title || "(untitled)",
      formatted: formatJsonPrompt(p, target),
      json: prettyJson(p),
      raw: p,
    }));
  }, [parsed, target]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast({ title: "Copied", description: "Content copied to clipboard." });
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Clipboard access was blocked.",
      });
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setRaw(text);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to read file",
        description: e.message,
      });
    }
  };

  const handleSaveAll = async () => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: "You must be signed in to save prompts.",
      });
      return;
    }
    if (!parsed.ok || !formattedPreviews.length) return;

    setSaving(true);
    let ok = 0;
    let failed = 0;
    for (const item of formattedPreviews) {
      try {
        const res = await PromptService.createPrompt({
          title: item.raw.title || "Imported JSON Prompt",
          content: item.formatted,
          description: item.raw.description,
          tags: item.raw.tags,
          userId: user.id,
          prompt_type: "text",
        });
        if (res.success) ok++;
        else {
          failed++;
          logger.error("Save failed", { error: res.error });
        }
      } catch (e) {
        failed++;
        logger.error("Save threw", { error: e });
      }
    }
    setSaving(false);
    toast({
      title: failed ? "Saved with errors" : "Saved",
      description: `${ok} saved${failed ? `, ${failed} failed` : ""}.`,
      variant: failed ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileJson className="h-6 w-6 text-warm-gold" />
            JSON Prompt Importer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Paste or upload JSON prompts. Preview formatted output, copy, download, or save to your prompts library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={target} onValueChange={(v) => setTarget(v as PromptTarget)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGETS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRaw(SAMPLE_JSON_PROMPT)}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Load sample
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Input */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">JSON Input</CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".json,application/json"
                id="json-upload"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("json-upload")?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload .json
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRaw("")}
                disabled={!raw}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='Paste a JSON object or array, e.g. { "title": "...", "content": "..." }'
              className="font-mono text-sm min-h-[420px]"
              spellCheck={false}
            />
            <div className="flex items-center justify-between text-xs">
              {raw && !parsed.ok ? (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {parsed.error}
                </span>
              ) : raw && parsed.ok ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Check className="h-3 w-3" />
                  Valid — {parsed.prompts.length} prompt
                  {parsed.prompts.length === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-muted-foreground">Awaiting input…</span>
              )}
              <span className="text-muted-foreground">{raw.length} chars</span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Preview</CardTitle>
            {parsed.ok && formattedPreviews.length > 0 && (
              <Button
                size="sm"
                onClick={handleSaveAll}
                disabled={saving}
                className="bg-warm-gold hover:bg-warm-gold/90"
              >
                <Save className="h-4 w-4 mr-1" />
                {saving
                  ? "Saving…"
                  : `Save ${formattedPreviews.length} as prompt${
                      formattedPreviews.length === 1 ? "" : "s"
                    }`}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!parsed.ok || !formattedPreviews.length ? (
              <div className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground">
                <FileJson className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">
                  Valid JSON will render here as a formatted prompt.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {formattedPreviews.map((item, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3 bg-muted/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline">#{idx + 1}</Badge>
                        <span className="font-medium truncate">
                          {item.title}
                        </span>
                      </div>
                    </div>
                    <Tabs defaultValue="formatted">
                      <TabsList className="h-8">
                        <TabsTrigger value="formatted" className="text-xs">
                          Formatted
                        </TabsTrigger>
                        <TabsTrigger value="json" className="text-xs">
                          JSON
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="formatted" className="mt-2">
                        <pre className="text-xs bg-background border rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                          {item.formatted}
                        </pre>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <CopyButton
                            value={item.formatted}
                            successDescription={`"${item.title}" copied as formatted prompt`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadFile(
                                `${item.title.replace(/\s+/g, "_") || "prompt"}.txt`,
                                item.formatted,
                                "text/plain"
                              )
                            }
                          >
                            <Download className="h-3 w-3 mr-1" />
                            .txt
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="json" className="mt-2">
                        <pre className="text-xs bg-background border rounded p-3 max-h-64 overflow-auto font-mono">
                          {item.json}
                        </pre>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <CopyButton
                            value={item.json}
                            successDescription={`"${item.title}" copied as JSON`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadFile(
                                `${item.title.replace(/\s+/g, "_") || "prompt"}.json`,
                                item.json,
                                "application/json"
                              )
                            }
                          >
                            <Download className="h-3 w-3 mr-1" />
                            .json
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
