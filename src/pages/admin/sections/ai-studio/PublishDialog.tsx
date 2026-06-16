import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { AiAssetKind, AiAssetPayload, AiStudioDraft } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AiStudioDraft | null;
  asset: AiAssetPayload | null;
  kind: AiAssetKind;
  targetLlm: string;
  onPublished: (promptId: string) => void;
}

function mapKindToPromptType(kind: AiAssetKind): "text" | "image" | "workflow" | "video" {
  switch (kind) {
    case "image":
      return "image";
    case "workflow":
      return "workflow";
    default:
      return "text";
  }
}

function serializeBody(asset: AiAssetPayload | null): string {
  if (!asset) return "";
  if (asset.json && typeof asset.json === "object") {
    const base = asset.body ? `${asset.body}\n\n` : "";
    return base + "```json\n" + JSON.stringify(asset.json, null, 2) + "\n```";
  }
  return asset.body || "";
}

export function PublishDialog({
  open,
  onOpenChange,
  draft,
  asset,
  kind,
  targetLlm,
  onPublished,
}: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [language, setLanguage] = useState<"en" | "ar" | "bilingual">("en");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(draft?.title || asset?.title || "");
    setDescription("");
    setLanguage((asset?.language as "en" | "ar" | "bilingual") || "en");
    setTags(asset?.tags || []);
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setCategories(data || []));
  }, [open, draft, asset]);

  const addTag = () => {
    const t = tagsInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagsInput("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handlePublish = async () => {
    if (!draft || !user?.id) return;
    const finalTitle = title.trim();
    if (!finalTitle) {
      toast.error("Title is required");
      return;
    }
    const body = serializeBody(asset);
    if (!body.trim()) {
      toast.error("Asset has no content to publish");
      return;
    }
    setPublishing(true);
    try {
      const selectedCat = categories.find((c) => c.id === category);
      const metadata: Record<string, unknown> = {
        description,
        tags,
        category: selectedCat?.name,
        language,
        target_llm: targetLlm,
        ai_generated: true,
        source_draft_id: draft.id,
        asset_kind: kind,
        params: asset?.params || {},
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("prompts")
        .insert({
          title: finalTitle,
          prompt_text: body,
          prompt_type: mapKindToPromptType(kind),
          user_id: user.id,
          image_path: draft.thumbnail_path,
          metadata: metadata as never,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        throw insertErr || new Error("Insert failed");
      }

      const { error: updErr } = await supabase
        .from("ai_studio_drafts")
        .update({
          status: "published",
          published_prompt_id: inserted.id,
          title: finalTitle,
        })
        .eq("id", draft.id);
      if (updErr) throw updErr;

      toast.success("Published to prompts catalog");
      onPublished(inserted.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Publish failed", { description: e?.message });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish to prompts catalog</DialogTitle>
          <DialogDescription>
            Promote this AI Studio draft into a public prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary shown in the catalog…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="bilingual">Bilingual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag and press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <Badge variant="outline" className="text-[10px]">{kind}</Badge>{" "}
              → published as{" "}
              <Badge variant="outline" className="text-[10px]">
                {mapKindToPromptType(kind)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Target LLM:</span> {targetLlm}
            </div>
            <div>
              <span className="text-muted-foreground">Thumbnail:</span>{" "}
              {draft?.thumbnail_path ? "Attached" : "None (using default)"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
