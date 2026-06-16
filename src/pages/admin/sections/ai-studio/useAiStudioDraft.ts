import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  AiAssetKind,
  AiAssetPayload,
  AiStudioDraft,
  ChatMsg,
} from "./types";

interface UseDraftReturn {
  draft: AiStudioDraft | null;
  loading: boolean;
  saving: boolean;
  messages: ChatMsg[];
  asset: AiAssetPayload | null;
  kind: AiAssetKind;
  targetLlm: string;
  setKind: (k: AiAssetKind) => void;
  setTargetLlm: (t: string) => void;
  setMessages: (m: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => void;
  setAsset: (a: AiAssetPayload | null) => void;
  setTitle: (t: string) => void;
  save: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAiStudioDraft(draftId: string | undefined): UseDraftReturn {
  const [draft, setDraft] = useState<AiStudioDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messages, setMessagesState] = useState<ChatMsg[]>([]);
  const [asset, setAsset] = useState<AiAssetPayload | null>(null);
  const [kind, setKind] = useState<AiAssetKind>("text");
  const [targetLlm, setTargetLlm] = useState<string>("chatgpt");
  const [title, setTitle] = useState<string>("");

  const load = useCallback(async () => {
    if (!draftId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_studio_drafts")
      .select("*")
      .eq("id", draftId)
      .maybeSingle();
    if (error) {
      toast.error("Failed to load draft", { description: error.message });
      setLoading(false);
      return;
    }
    if (data) {
      const d = data as unknown as AiStudioDraft;
      setDraft(d);
      setMessagesState(Array.isArray(d.messages) ? d.messages : []);
      setAsset((d.payload as AiAssetPayload) || null);
      setKind((d.kind as AiAssetKind) || "text");
      setTargetLlm(d.target_llm || "chatgpt");
      setTitle(d.title || "");
    }
    setLoading(false);
  }, [draftId]);

  useEffect(() => {
    load();
  }, [load]);

  const setMessages = useCallback(
    (m: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => {
      setMessagesState((prev) => (typeof m === "function" ? (m as (p: ChatMsg[]) => ChatMsg[])(prev) : m));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!draftId) return;
    setSaving(true);
    const payload = asset || {};
    const resolvedTitle =
      title.trim() || (asset?.title?.trim() ?? "") || messages[0]?.content.slice(0, 80) || "Untitled draft";
    const { error } = await supabase
      .from("ai_studio_drafts")
      .update({
        kind,
        title: resolvedTitle,
        body: asset?.body ?? null,
        payload: payload as never,
        target_llm: targetLlm,
        messages: messages as never,
      })
      .eq("id", draftId);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success("Draft saved");
    await load();
  }, [draftId, asset, kind, targetLlm, messages, title, load]);

  return {
    draft,
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
    save,
    refetch: load,
  };
}
