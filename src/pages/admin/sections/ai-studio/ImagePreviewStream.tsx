import { useCallback, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ImageIcon, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  prompt: string;
  draftId: string;
  initialThumbnailPath: string | null;
  onSaved: (path: string) => void;
}

const IMAGE_MODELS = [
  { value: "google/gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image (fast)" },
  { value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (Nano Banana)" },
  { value: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image (best quality)" },
  { value: "openai/gpt-image-2", label: "GPT-Image 2 (OpenAI)" },
  { value: "openai/gpt-image-1-mini", label: "GPT-Image 1 Mini (cheaper)" },
];

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] || "image/png";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function ImagePreviewStream({ prompt, draftId, initialThumbnailPath, onSaved }: Props) {
  const [model, setModel] = useState(IMAGE_MODELS[0].value);
  const [src, setSrc] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(() => {
    if (!initialThumbnailPath) return null;
    const { data } = supabase.storage.from("prompt-images").getPublicUrl(initialThumbnailPath);
    return data.publicUrl;
  });
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("No prompt to generate from", {
        description: "Add an image prompt in the asset body first.",
      });
      return;
    }
    setSrc(null);
    setIsFinal(false);
    setGenerating(true);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-studio-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ prompt, model }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        let errMsg = `Image generation failed (${res.status})`;
        try {
          const j = JSON.parse(errBody);
          if (j?.error) errMsg = j.error;
        } catch { /* ignore */ }
        toast.error(errMsg);
        setGenerating(false);
        return;
      }

      let sawCompleted = false;
      let streamError: string | null = null;
      const parser = createParser({
        onEvent(event) {
          let payload: {
            b64_json?: string;
            type?: string;
            error?: { message?: string };
          };
          try { payload = JSON.parse(event.data); } catch { return; }

          // Failures arrive as a named `error` event or a provider-native
          // frame whose payload type is "error". Both are terminal.
          if (event.event === "error" || payload?.type === "error") {
            streamError = payload?.error?.message || "Image generation failed";
            return;
          }

          if (
            event.event !== "image_generation.partial_image" &&
            event.event !== "image_generation.completed"
          ) return;
          if (!payload.b64_json) return;
          const dataUrl = `data:image/png;base64,${payload.b64_json}`;
          const final = event.event === "image_generation.completed";
          flushSync(() => {
            setSrc(dataUrl);
            if (final) setIsFinal(true);
          });
          if (final) sawCompleted = true;
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(value);
        }
      } finally {
        reader.cancel().catch(() => {});
      }
      if (streamError) {
        toast.error("Image generation failed", { description: streamError });
      } else if (!sawCompleted) {
        toast.warning("Image stream ended without a completion event");
      }
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error("Image generation error", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [prompt, model]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const saveThumbnail = useCallback(async () => {
    if (!src || !draftId) return;
    setSaving(true);
    try {
      const blob = dataUrlToBlob(src);
      const path = `ai-studio/${draftId}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("prompt-images")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) {
        toast.error("Upload failed", { description: upErr.message });
        return;
      }
      const { error: updErr } = await supabase
        .from("ai_studio_drafts")
        .update({ thumbnail_path: path })
        .eq("id", draftId);
      if (updErr) {
        toast.error("Failed to save thumbnail", { description: updErr.message });
        return;
      }
      const { data } = supabase.storage.from("prompt-images").getPublicUrl(path);
      setSavedUrl(data.publicUrl);
      onSaved(path);
      toast.success("Thumbnail saved to draft");
    } finally {
      setSaving(false);
    }
  }, [src, draftId, onSaved]);

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-background">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ImageIcon className="h-4 w-4" />
          Thumbnail / image preview
        </div>
        <Select value={model} onValueChange={setModel} disabled={generating}>
          <SelectTrigger className="h-8 text-xs w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative aspect-square w-full max-w-sm mx-auto rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt="Generated preview"
            className={`w-full h-full object-cover transition-[filter] duration-300 ${
              isFinal ? "blur-0" : "blur-2xl"
            }`}
          />
        ) : savedUrl ? (
          <img src={savedUrl} alt="Saved thumbnail" className="w-full h-full object-cover" />
        ) : (
          <div className="text-xs text-muted-foreground text-center px-4">
            No preview yet. Click "Generate" to render the image prompt.
          </div>
        )}
        {generating && (
          <div className="absolute top-2 right-2 bg-background/80 rounded-full p-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {generating ? (
          <Button size="sm" variant="outline" onClick={cancel}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={generate} disabled={!prompt.trim()}>
            <ImageIcon className="h-3.5 w-3.5 mr-1" />
            {src ? "Regenerate" : "Generate"}
          </Button>
        )}
        <Button size="sm" onClick={saveThumbnail} disabled={!src || !isFinal || saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1" />
          )}
          Save as thumbnail
        </Button>
      </div>
    </div>
  );
}
