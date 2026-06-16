import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAiStudioDraft } from "./useAiStudioDraft";
import { AiStudioChat } from "./AiStudioChat";
import { AssetPreviewPane } from "./AssetPreviewPane";
import { DraftsSidebar } from "./DraftsSidebar";
import type { AiAssetKind } from "./types";

const KIND_OPTIONS: { value: AiAssetKind; label: string }[] = [
  { value: "text", label: "Text prompt" },
  { value: "json", label: "JSON / spec" },
  { value: "skill", label: "Skill package" },
  { value: "image", label: "Image prompt" },
  { value: "workflow", label: "Workflow" },
  { value: "other", label: "Other" },
];

const LLM_OPTIONS = [
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
  { value: "manus", label: "Manus" },
  { value: "gemini", label: "Gemini" },
  { value: "midjourney", label: "Midjourney" },
  { value: "generic", label: "Generic" },
];

export default function AiStudioPage() {
  const { draftId } = useParams<{ draftId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // If no draftId, bootstrap a new draft and navigate to it.
  useEffect(() => {
    if (draftId || !user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("ai_studio_drafts")
        .insert({ user_id: user.id, kind: "text", title: "New draft" })
        .select("id")
        .single();
      if (data?.id && !error) {
        navigate(`/admin/ai-studio/${data.id}`, { replace: true });
      }
    })();
  }, [draftId, user?.id, navigate]);

  const {
    loading,
    saving,
    messages,
    asset,
    kind,
    targetLlm,
    setKind,
    setTargetLlm,
    setMessages,
    setAsset,
    setTitle,
    draft,
    save,
  } = useAiStudioDraft(draftId);

  if (!draftId || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[240px_1fr_1fr] h-[calc(100vh-9rem)] gap-3">
      <DraftsSidebar activeId={draftId} />

      <div className="flex flex-col border rounded-lg overflow-hidden bg-background">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">AI Studio</span>
          </div>
          <Input
            defaultValue={draft?.title || ""}
            onBlur={(e) => setTitle(e.target.value)}
            placeholder="Draft title…"
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">
                Kind
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AiAssetKind)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">
                Target LLM
              </Label>
              <Select value={targetLlm} onValueChange={setTargetLlm}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <AiStudioChat
          messages={messages}
          setMessages={setMessages}
          onAsset={setAsset}
          kind={kind}
          targetLlm={targetLlm}
        />
      </div>

      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex justify-end gap-2">
          <Button
            onClick={save}
            disabled={saving}
            size="sm"
            variant="outline"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save draft
          </Button>
          <Button size="sm" disabled title="Publishing arrives in Phase 3">
            Publish
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <AssetPreviewPane asset={asset} />
        </div>
      </div>
    </div>
  );
}
