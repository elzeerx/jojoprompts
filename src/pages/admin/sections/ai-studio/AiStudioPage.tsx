import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
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
import { ArrowRight, Loader2, Rocket, Save, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useAiStudioDraft } from "./useAiStudioDraft";
import { AiStudioChat } from "./AiStudioChat";
import { AssetPreviewPane } from "./AssetPreviewPane";
import { DraftsSidebar } from "./DraftsSidebar";
import { ImagePreviewStream } from "./ImagePreviewStream";
import { PublishDialog } from "./PublishDialog";
import { aiStudioDraftRoute } from "./routes";
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

export default function AiStudioPage({ draftIdOverride }: { draftIdOverride?: string }) {
  const { draftId: routeDraftId } = useParams<{ draftId?: string }>();
  const draftId = draftIdOverride ?? routeDraftId;
  const { user } = useAuth();
  const navigate = useNavigate();

  // Deferred draft creation. We no longer auto-INSERT on mount, so simply
  // Opening AI Studio does not litter the drafts table.
  const [creating, setCreating] = useState(false);
  const createDraft = async () => {
    if (!user?.id || creating) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("ai_studio_drafts")
        .insert({ user_id: user.id, kind: "text", title: "New draft" })
        .select("id")
        .single();
      if (error || !data?.id) {
        throw error ?? new Error("The draft was not created.");
      }
      navigate(aiStudioDraftRoute(data.id));
    } catch (error) {
      console.error("Failed to create AI Studio draft:", error);
      toast.error("Could not create the draft. Please try again.");
    } finally {
      setCreating(false);
    }
  };

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
    setThumbnailPath,
    draft,
    save,
  } = useAiStudioDraft(draftId);

  const [publishOpen, setPublishOpen] = useState(false);
  const importedResourceId =
    draft?.status === "imported" ? draft.published_resource_id : null;
  const isImported = Boolean(importedResourceId);

  if (!draftId) {
    return (
      <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 gap-3 lg:h-[calc(100vh-9rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <DraftsSidebar activeId={undefined} />
        <div className="flex flex-col items-center justify-center border rounded-lg bg-background p-8 text-center">
          <Sparkles className="h-8 w-8 text-primary mb-3" />
          <h1 className="text-lg font-semibold">AI Studio</h1>
          <p className="mt-1 mb-4 max-w-md text-sm text-muted-foreground">
            Pick an existing draft from the sidebar or start a new one. Drafts are only
            created when you explicitly begin, so the drafts table stays clean.
          </p>
          <Button onClick={createDraft} disabled={creating || !user?.id}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Sparkles className="h-4 w-4 me-2" />}
            Start a new draft
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Loading AI Studio draft">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 gap-3 lg:h-[calc(100vh-9rem)] lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
      <h1 className="sr-only">AI Studio</h1>
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
            className="min-h-[44px] text-sm sm:min-h-[36px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">
                Kind
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AiAssetKind)}>
                <SelectTrigger className="min-h-[44px] text-xs sm:min-h-[36px]">
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
                <SelectTrigger className="min-h-[44px] text-xs sm:min-h-[36px]">
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
        <div className="flex justify-end items-center gap-2">
          {isImported && (
            <Badge variant="default" className="mr-auto">
              Sent to publisher
            </Badge>
          )}
          <Button onClick={save} disabled={saving} size="sm" variant="outline">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save draft
          </Button>
          {isImported ? (
            <Button
              size="sm"
              onClick={() =>
                navigate(
                  `/admin/content?tool=edit&resourceId=${encodeURIComponent(importedResourceId)}`,
                )
              }
            >
              Continue in publisher
              <ArrowRight className="h-4 w-4 ms-2" aria-hidden />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={!asset}
              title={!asset ? "Generate an asset first" : "Continue to the V2 publisher"}
            >
              <Rocket className="h-4 w-4 mr-2" />
              Continue to publisher
            </Button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
          <AssetPreviewPane asset={asset} />
          <ImagePreviewStream
            prompt={asset?.body || ""}
            draftId={draftId}
            initialThumbnailPath={draft?.thumbnail_path || null}
            onSaved={setThumbnailPath}
          />
        </div>
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        draft={draft}
        asset={asset}
        kind={kind}
        targetLlm={targetLlm}
      />
    </div>
  );
}
