
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { CategoriesTable } from "./CategoriesTable";
import { CategoryDialog } from "./CategoryDialog";
import { Category } from "@/types/category";

export function CategoriesManagement() {
  const { categories, loading, createCategory, updateCategory } = useCategories();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  const handleSave: ComponentProps<typeof CategoryDialog>["onSave"] = async (data) => {
    if ("id" in data) {
      await updateCategory(data.id, data.data);
    } else {
      await createCategory(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Taxonomy</h1>
          <p className="text-muted-foreground">
            Organize the V2 catalog with reusable categories and filter labels.
          </p>
        </div>
        <Button className="min-h-[44px] w-full sm:w-auto" onClick={handleCreateCategory}>
          <Plus className="me-2 h-4 w-4" aria-hidden />
          Add Category
        </Button>
      </div>

      <CategoriesTable
        categories={categories}
        loading={loading}
        onEdit={handleEditCategory}
        onToggleActive={updateCategory}
      />

      <CategoryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        category={editingCategory}
        onSave={handleSave}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
