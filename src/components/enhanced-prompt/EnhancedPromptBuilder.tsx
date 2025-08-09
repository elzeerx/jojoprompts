import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePromptValidation } from "@/utils/promptValidation";
import { mapOpenAIModel, OPENAI_MODEL_ALIAS } from "@/utils/aiModelConfig";
import { Sparkles, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useSmartSuggestions } from "@/pages/admin/components/prompts/hooks/useSmartSuggestions";

// Lightweight form shape for v1
interface FormData {
  title: string;
  promptText: string;
  category: string;
  modelType: "text" | "image" | "video" | "workflow";
  stylePreferences?: string;
  tags: string[];
}

export function EnhancedPromptBuilder() {
  // SEO basics
  useEffect(() => {
    document.title = "Enhanced Prompt Builder | JojoPrompts";
    const metaDesc = document.querySelector("meta[name='description']");
    const canonical = document.querySelector("link[rel='canonical']");
    if (!metaDesc) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = "Create, validate and enhance AI prompts with live quality scoring.";
      document.head.appendChild(m);
    } else {
      metaDesc.setAttribute("content", "Create, validate and enhance AI prompts with live quality scoring.");
    }
    if (!canonical) {
      const link = document.createElement("link");
      link.rel = "canonical";
      link.href = window.location.origin + "/enhanced-prompt";
      document.head.appendChild(link);
    }
  }, []);

  const [form, setForm] = useState<FormData>({
    title: "",
    promptText: "",
    category: "general",
    modelType: "text",
    stylePreferences: "",
    tags: [],
  });
  const [enhancing, setEnhancing] = useState(false);

  // Validation & quality
  const validation = usePromptValidation(
    {
      title: form.title,
      prompt_text: form.promptText,
      prompt_type: form.modelType,
      metadata: {
        category: form.category,
        tags: form.tags,
        style: form.stylePreferences,
        target_model: OPENAI_MODEL_ALIAS,
      },
    },
    { checkQuality: true }
  );

  // Smart suggestions based on prompt text + category
  const { suggestions } = useSmartSuggestions(form.promptText, form.category);

  const addTag = useCallback((tag: string) => {
    setForm((prev) => ({ ...prev, tags: Array.from(new Set([...(prev.tags || []), tag])) }));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setForm((prev) => ({ ...prev, tags: (prev.tags || []).filter((t) => t !== tag) }));
  }, []);

  const handleEnhance = useCallback(async () => {
    if (!form.promptText.trim()) {
      toast({ variant: "destructive", title: "Add prompt text first", description: "Please write a basic prompt to enhance." });
      return;
    }

    setEnhancing(true);
    try {
      const model = mapOpenAIModel(OPENAI_MODEL_ALIAS);
      const { data, error } = await supabase.functions.invoke("enhance-prompt", {
        body: {
          prompt_description: form.promptText,
          model_type: form.modelType,
          style_preferences: form.stylePreferences || "",
          model, // pass mapped model id to backend
        },
      });

      if (error) throw error;

      const enhanced = data?.enhanced_prompt || data?.enhanced || data?.content;
      if (enhanced) {
        setForm((prev) => ({ ...prev, promptText: enhanced }));
        toast({ title: "Prompt enhanced", description: "We refined your prompt with AI." });
      } else {
        toast({ variant: "destructive", title: "No content returned", description: "The AI did not return an enhanced prompt." });
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Enhancement failed", description: e?.message || "Please try again." });
    } finally {
      setEnhancing(false);
    }
  }, [form.promptText, form.modelType, form.stylePreferences]);

  const errors = validation.errors || {};
  const qualityScore = validation.qualityScore ?? 0;

  // Derived tokens/cost (placeholder simple estimate)
  const tokenEstimate = useMemo(() => Math.ceil((form.promptText.length || 0) / 4), [form.promptText]);

  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Enhanced Prompt Builder</h1>
        <p className="text-sm text-muted-foreground">Build, validate, and enhance prompts for ChatGPT, image, video, and workflows.</p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <section aria-labelledby="builder-form">
          <Card>
            <CardHeader>
              <CardTitle id="builder-form">Prompt Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="e.g., Cinematic portrait with rim light" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" placeholder="general, midjourney, n8n..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="modelType">Prompt Type</Label>
                  <Select value={form.modelType} onValueChange={(v) => setForm({ ...form, modelType: v as FormData["modelType"] })}>
                    <SelectTrigger id="modelType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">ChatGPT Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="promptText">Prompt</Label>
                <Textarea id="promptText" rows={8} placeholder="Describe what you want to generate..." value={form.promptText} onChange={(e) => setForm({ ...form, promptText: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="stylePreferences">Style / Notes</Label>
                <Input id="stylePreferences" placeholder="e.g., cinematic, soft light, 85mm" value={form.stylePreferences} onChange={(e) => setForm({ ...form, stylePreferences: e.target.value })} />
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.tags || []).map((t) => (
                    <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => removeTag(t)}>
                      {t} ✕
                    </Badge>
                  ))}
                </div>
                {suggestions?.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestions.tags.slice(0, 8).map((t) => (
                      <Button key={t} size="sm" variant="outline" onClick={() => addTag(t)}>
                        + {t}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleEnhance} disabled={enhancing}>
                  {enhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Enhance with AI
                </Button>
                <span className="text-xs text-muted-foreground">Model: {mapOpenAIModel(OPENAI_MODEL_ALIAS)}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Right: Preview & Validation */}
        <aside aria-labelledby="preview-panel">
          <Card>
            <CardHeader>
              <CardTitle id="preview-panel">Preview & Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {qualityScore >= 70 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="text-sm">Quality score: {qualityScore}</span>
                <span className="ml-auto text-xs text-muted-foreground">~{tokenEstimate} tokens</span>
              </div>

              {Object.keys(errors).length > 0 && (
                <div className="rounded-md border p-3">
                  <div className="font-medium mb-1">Issues</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {Object.entries(errors).map(([k, v]) => (
                      <li key={k}>{String(v)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="font-medium mb-2">Current Prompt</div>
                <pre className="whitespace-pre-wrap rounded-md border p-3 text-sm bg-background/50">{form.promptText || "Your enhanced prompt will appear here."}</pre>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

export default EnhancedPromptBuilder;
