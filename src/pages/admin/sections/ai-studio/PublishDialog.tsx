import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import {
  buildAiStudioPublisherHandoff,
} from "../publishing/aiStudioHandoff";
import type { AiAssetKind, AiAssetPayload, AiStudioDraft } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: AiStudioDraft | null;
  asset: AiAssetPayload | null;
  kind: AiAssetKind;
  targetLlm: string;
}

export function PublishDialog({
  open,
  onOpenChange,
  draft,
  asset,
  kind,
  targetLlm,
}: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] =
    useState<"en" | "ar" | "bilingual">("en");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(draft?.title || asset?.title || "");
    setDescription("");
    setLanguage(
      (asset?.language as "en" | "ar" | "bilingual") || "en",
    );
    setTags(asset?.tags || []);
    setTagsInput("");
  }, [open, draft, asset]);

  const addTag = () => {
    const tag = tagsInput.trim();
    if (!tag) return;
    if (!tags.includes(tag)) setTags([...tags, tag]);
    setTagsInput("");
  };

  const continueToPublisher = () => {
    if (!draft || !asset) return;
    const finalTitle = title.trim();
    if (!finalTitle) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("A public summary is required");
      return;
    }

    const handoff = buildAiStudioPublisherHandoff({
      draft,
      asset,
      kind,
      targetLlm,
      title: finalTitle,
      description,
      tags,
      language,
    });
    if (
      !handoff.private_content.content_en.trim() &&
      !handoff.private_content.content_ar.trim()
    ) {
      toast.error("The generated asset has no delivery content");
      return;
    }

    onOpenChange(false);
    navigate("/admin/content?tool=new", {
      state: { aiStudioImport: handoff },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Continue in the V2 publisher</DialogTitle>
          <DialogDescription>
            AI Studio prepares the source. The unified publisher handles
            bilingual metadata, protected version content, compatibility,
            pricing, review, and publication.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="ai-publisher-title">Title</Label>
            <Input
              id="ai-publisher-title"
              className="min-h-[44px]"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ai-publisher-summary">Public summary</Label>
            <Textarea
              id="ai-publisher-summary"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain the outcome without exposing the paid content."
              maxLength={280}
            />
          </div>
          <div>
            <Label htmlFor="ai-publisher-language">Content language</Label>
            <Select
              value={language}
              onValueChange={(value) =>
                setLanguage(value as typeof language)
              }
            >
              <SelectTrigger
                id="ai-publisher-language"
                className="min-h-[44px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="bilingual">Bilingual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ai-publisher-tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="ai-publisher-tags"
                className="min-h-[44px]"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag and press Enter"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={addTag}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
                      onClick={() =>
                        setTags(tags.filter((value) => value !== tag))
                      }
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            Source kind: <strong>{kind}</strong> · Target:{" "}
            <strong>{targetLlm}</strong>. Nothing is published from this
            dialog.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="min-h-[44px]" onClick={continueToPublisher}>
            Continue to publisher
            <ArrowRight className="ms-2 h-4 w-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
