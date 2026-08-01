import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Archive, FileText, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { AiStudioDraft } from "./types";
import { AI_STUDIO_BASE_ROUTE, aiStudioDraftRoute } from "./routes";

interface Props {
  activeId?: string;
}

export function DraftsSidebar({ activeId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<AiStudioDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_studio_drafts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Failed to load drafts", { description: error.message });
    } else {
      setDrafts((data || []) as unknown as AiStudioDraft[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeId]);

  const handleNew = async () => {
    if (!user?.id) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("ai_studio_drafts")
      .insert({
        user_id: user.id,
        kind: "text",
        title: "New draft",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Could not create draft", { description: error?.message });
      return;
    }
    navigate(aiStudioDraftRoute(data.id));
  };

  const handleArchive = async (
    draft: AiStudioDraft,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const restoring = draft.status === "archived";
    const { error } = await supabase
      .from("ai_studio_drafts")
      .update({ status: restoring ? "draft" : "archived" })
      .eq("id", draft.id);
    if (error) {
      toast.error(restoring ? "Restore failed" : "Archive failed", {
        description: error.message,
      });
      return;
    }
    toast.success(restoring ? "Draft restored" : "Draft archived");
    if (!restoring && activeId === draft.id) navigate(AI_STUDIO_BASE_ROUTE);
    else load();
  };

  return (
    <div className="flex min-h-[220px] flex-col border bg-muted/20 lg:h-full lg:min-h-0 lg:border-y-0 lg:border-s-0">
      <div className="p-3 border-b">
        <Button
          onClick={handleNew}
          disabled={creating}
          size="sm"
          className="w-full justify-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          New draft
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && (
            <p className="text-xs text-muted-foreground px-2 py-4">Loading…</p>
          )}
          {!loading && drafts.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-4">
              No drafts yet. Click "New draft" to start.
            </p>
          )}
          {drafts.map((d) => {
            const isActive = d.id === activeId;
            return (
              <Link
                key={d.id}
                to={aiStudioDraftRoute(d.id)}
                className={`group flex min-h-[44px] items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors ${
                  isActive ? "bg-accent" : ""
                }`}
              >
                <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">
                    {d.title || "Untitled"}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {d.kind}
                    </Badge>
                    <Badge
                      variant={
                        d.status === "imported" || d.status === "published"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px] px-1 py-0"
                    >
                      {d.status === "imported" ? "in publisher" : d.status}
                    </Badge>
                  </div>
                </div>
                {(d.status === "draft" || d.status === "archived") && (
                  <button
                    onClick={(e) => handleArchive(d, e)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    aria-label={`${d.status === "archived" ? "Restore" : "Archive"} draft`}
                  >
                    {d.status === "archived" ? (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
