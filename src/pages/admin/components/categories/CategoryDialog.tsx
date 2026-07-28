import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Category, CategoryWriteInput } from "@/types/category";
import { createLogger } from "@/utils/logging";
import { handleError } from "@/utils/errorHandler";

const logger = createLogger("V2_TAXONOMY_DIALOG");

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSave: (
    data:
      | CategoryWriteInput
      | { id: string; data: Partial<CategoryWriteInput> },
  ) => Promise<void>;
  onClose: () => void;
}

const EMPTY_FORM: CategoryWriteInput = {
  name: "",
  description: null,
  link_path: "",
  subcategories: [],
  display_order: 0,
  is_active: true,
};

function normalizedPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
  onClose,
}: CategoryDialogProps) {
  const [form, setForm] = useState<CategoryWriteInput>(EMPTY_FORM);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(
      category
        ? {
            name: category.name,
            description: category.description,
            link_path: category.link_path,
            subcategories: category.subcategories ?? [],
            display_order: category.display_order,
            is_active: category.is_active,
          }
        : EMPTY_FORM,
    );
    setNewLabel("");
  }, [category, open]);

  const addLabel = () => {
    const label = newLabel.trim();
    if (!label || form.subcategories.includes(label)) return;
    setForm((current) => ({
      ...current,
      subcategories: [...current.subcategories, label],
    }));
    setNewLabel("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const linkPath = normalizedPath(form.link_path);
    if (!name || !linkPath) return;

    const payload: CategoryWriteInput = {
      ...form,
      name,
      description: form.description?.trim() || null,
      link_path: linkPath,
      display_order: Math.max(0, Math.round(form.display_order)),
    };

    setLoading(true);
    try {
      await onSave(
        category
          ? { id: category.id, data: payload }
          : payload,
      );
      onClose();
    } catch (error) {
      const appError = handleError(error, {
        component: "CategoryDialog",
        action: "saveCategory",
      });
      logger.error("Error saving category", { error: appError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b p-5 text-start sm:p-6">
          <DialogTitle>
            {category ? "Edit category" : "Create category"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <form
            id="v2-taxonomy-form"
            className="space-y-5 p-5 sm:p-6"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  className="min-h-[44px]"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-path">Catalog path</Label>
                <Input
                  id="category-path"
                  className="min-h-[44px]"
                  value={form.link_path}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      link_path: event.target.value,
                    }))
                  }
                  placeholder="/explore?category=marketing"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={form.description ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-label">Filter labels</Label>
              <p className="text-xs text-muted-foreground">
                Add alternate labels that should map to this category.
              </p>
              <div className="flex gap-2">
                <Input
                  id="category-label"
                  className="min-h-[44px]"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addLabel();
                    }
                  }}
                  placeholder="e.g. image-generation"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] min-w-[44px]"
                  aria-label="Add filter label"
                  onClick={addLabel}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2" aria-live="polite">
                {form.subcategories.map((label) => (
                  <Badge key={label} variant="secondary" className="gap-1 py-1">
                    {label}
                    <button
                      type="button"
                      className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold"
                      aria-label={`Remove ${label}`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          subcategories: current.subcategories.filter(
                            (value) => value !== label,
                          ),
                        }))
                      }
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-order">Display order</Label>
                <Input
                  id="category-order"
                  className="min-h-[44px]"
                  type="number"
                  min={0}
                  step={1}
                  value={form.display_order}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      display_order: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div className="flex min-h-[44px] items-center justify-between gap-4 self-end rounded-lg border px-3">
                <Label htmlFor="category-active">Visible in catalog</Label>
                <Switch
                  id="category-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, is_active: checked }))
                  }
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="border-t p-5 sm:p-6">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="v2-taxonomy-form"
            className="min-h-[44px]"
            disabled={loading}
          >
            {loading ? "Saving…" : "Save category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
